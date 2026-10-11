-- Reviewed local-only migration. No history rows are deleted.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user1_role TEXT CHECK(user1_role IN ('household','helper'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user2_role TEXT CHECK(user2_role IN ('household','helper'));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='conversation_opposite_roles' AND conrelid='conversations'::regclass) THEN
  ALTER TABLE conversations ADD CONSTRAINT conversation_opposite_roles CHECK(
   (user1_role IS NULL AND user2_role IS NULL) OR
   (user1_role IS NOT NULL AND user2_role IS NOT NULL AND user1_role<>user2_role));
 END IF;
END $$;
-- A sole household/worker relationship is deterministic. Ambiguous legacy dual/dual
-- threads stay unassigned, preserved for owner-reviewed assignment; never guess.
WITH directions AS (
 SELECT c.id, d.home FROM conversations c
 CROSS JOIN LATERAL (
   SELECT b.user_id AS home FROM bookings b JOIN helpers h ON h.id=b.helper_id
   WHERE (b.user_id=c.user1_id AND h.user_id=c.user2_id) OR (b.user_id=c.user2_id AND h.user_id=c.user1_id)
   UNION
   SELECT j.user_id FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN helpers h ON h.id=a.helper_id
   WHERE (j.user_id=c.user1_id AND h.user_id=c.user2_id) OR (j.user_id=c.user2_id AND h.user_id=c.user1_id)
   UNION
   SELECT CASE WHEN u1.role='household' OR u2.role='helper' THEN u1.id ELSE u2.id END
   FROM users u1,users u2 WHERE u1.id=c.user1_id AND u2.id=c.user2_id
   AND ((u1.role='household' AND u2.role IN('helper','both')) OR (u2.role='household' AND u1.role IN('helper','both'))
    OR (u1.role='helper' AND u2.role='both') OR (u2.role='helper' AND u1.role='both'))
 ) d
), unambiguous AS (SELECT id,MIN(home) AS home FROM directions GROUP BY id HAVING COUNT(DISTINCT home)=1)
UPDATE conversations c SET user1_role=CASE WHEN c.user1_id=d.home THEN 'household' ELSE 'helper' END,
 user2_role=CASE WHEN c.user2_id=d.home THEN 'household' ELSE 'helper' END
FROM unambiguous d WHERE c.id=d.id AND c.user1_role IS NULL AND c.user2_role IS NULL;
-- Replace pair-only uniqueness to support the same dual users in opposite roles.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user1_id_user2_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_role_pair ON conversations((LEAST(user1_id,user2_id)),(GREATEST(user1_id,user2_id)),(CASE WHEN user1_id<user2_id THEN user1_role ELSE user2_role END))
 WHERE user1_role IS NOT NULL AND user2_role IS NOT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS audience TEXT CHECK(audience IN('household','helper','admin'));
-- Single-role history is grounded in its account role. Old dual history is preserved
-- unassigned because its active role was never recorded. No cross-role disclosure.
UPDATE ai_messages m SET audience=u.role FROM users u WHERE m.user_id=u.id AND m.audience IS NULL AND u.role<>'both';
CREATE INDEX IF NOT EXISTS ai_messages_role_history ON ai_messages(user_id,audience,id);
ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS audience TEXT CHECK(audience IN('household','helper','admin'));
UPDATE push_devices d SET audience=u.role FROM users u WHERE d.user_id=u.id AND d.audience IS NULL AND u.role<>'both';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS audience TEXT CHECK(audience IN('household','helper'));
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
UPDATE complaints c SET audience=u.role FROM users u WHERE c.complainant_id=u.id AND c.audience IS NULL AND u.role IN('household','helper');
-- Recover known message/complaint audiences without rewriting private content.
UPDATE notifications n SET data=n.data||jsonb_build_object('audience',CASE WHEN c.user1_id=n.user_id THEN c.user1_role ELSE c.user2_role END)
FROM conversations c WHERE n.type='message_new' AND n.data->>'conversation_id'=c.id::text AND n.data->>'audience' IS NULL
AND (c.user1_id=n.user_id OR c.user2_id=n.user_id) AND c.user1_role IS NOT NULL;
UPDATE notifications n SET data=n.data||jsonb_build_object('audience',c.audience)
FROM complaints c WHERE n.type='complaint_updated' AND n.data->>'complaint_id'=c.id::text AND n.user_id=c.complainant_id
AND n.data->>'audience' IS NULL AND c.audience IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN NOT NULL DEFAULT false;
-- Existing coordinates remain intact, but cannot become trusted merely by existing.
CREATE OR REPLACE FUNCTION clear_stale_location() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.location IS DISTINCT FROM OLD.location AND NEW.latitude IS NOT DISTINCT FROM OLD.latitude AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude THEN
  NEW.latitude=NULL; NEW.longitude=NULL; NEW.location_confirmed=false;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS clear_stale_location ON users;
CREATE TRIGGER clear_stale_location BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION clear_stale_location();
INSERT INTO helpearly_schema(version) VALUES(4) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION marketplace_notification() RETURNS TRIGGER AS $$
DECLARE worker INTEGER; recipient INTEGER; heading TEXT; kind TEXT; payload JSONB; event TEXT;
BEGIN
  IF TG_TABLE_NAME='bookings' THEN
    IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
    SELECT user_id INTO worker FROM helpers WHERE id=NEW.helper_id;
    kind='booking_'||NEW.status; heading=CASE WHEN TG_OP='INSERT' THEN 'New service booking' ELSE 'Booking status updated' END;
    payload=jsonb_build_object('booking_id',NEW.id,'status',NEW.status);
    PERFORM enqueue_notification(worker,'booking:'||NEW.id||':'||NEW.status,kind,heading,payload||jsonb_build_object('audience','helper'));
    IF TG_OP='UPDATE' OR NEW.status='confirmed' THEN
      PERFORM enqueue_notification(NEW.user_id,'booking:'||NEW.id||':'||NEW.status,kind,heading,payload||jsonb_build_object('audience','household'));
    END IF;
    IF NEW.status='completed' AND NEW.job_application_id IS NOT NULL THEN
      UPDATE jobs SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT job_id FROM job_applications WHERE id=NEW.job_application_id);
    END IF;
  ELSIF TG_TABLE_NAME='job_applications' THEN
    IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
    IF TG_OP='INSERT' THEN
      SELECT user_id INTO recipient FROM jobs WHERE id=NEW.job_id;
      heading='New job proposal'; kind='proposal_new';
    ELSE
      SELECT user_id INTO recipient FROM helpers WHERE id=NEW.helper_id;
      heading='Job proposal status updated'; kind='proposal_'||NEW.status;
    END IF;
    PERFORM enqueue_notification(recipient,'proposal:'||NEW.id||':'||NEW.status,kind,heading,jsonb_build_object('job_id',NEW.job_id,'application_id',NEW.id,'status',NEW.status,'audience',CASE WHEN TG_OP='INSERT' THEN 'household' ELSE 'helper' END));
  ELSIF TG_TABLE_NAME='messages' THEN
    SELECT CASE WHEN user1_id=NEW.sender_id THEN user2_id ELSE user1_id END INTO recipient FROM conversations WHERE id=NEW.conversation_id;
    PERFORM enqueue_notification(recipient,'message:'||NEW.id,'message_new','New message',jsonb_build_object('conversation_id',NEW.conversation_id,'audience',(SELECT CASE WHEN user1_id=recipient THEN user1_role ELSE user2_role END FROM conversations WHERE id=NEW.conversation_id)));
  ELSIF TG_TABLE_NAME='complaints' THEN
    IF NEW.status<>OLD.status OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      PERFORM enqueue_notification(NEW.complainant_id,'complaint:'||NEW.id||':'||NEW.updated_at,'complaint_updated','Complaint status updated',jsonb_build_object('complaint_id',NEW.id,'audience',NEW.audience));
    END IF;
  ELSIF TG_TABLE_NAME='helpers' THEN
    IF NEW.is_verified<>OLD.is_verified THEN
      PERFORM enqueue_notification(NEW.user_id,'verification:'||NEW.id||':'||CURRENT_TIMESTAMP,'verification_updated','Worker verification updated',jsonb_build_object('verified',NEW.is_verified,'audience','helper'));
    END IF;
  ELSIF TG_TABLE_NAME='emergency_requests' THEN
    IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
    kind=CASE WHEN TG_OP='INSERT' THEN 'emergency_new' ELSE 'emergency_'||NEW.status END;
    heading=CASE WHEN TG_OP='INSERT' THEN 'New emergency service request' ELSE 'Emergency request status updated' END;
    payload=jsonb_build_object('request_id',NEW.id,'status',NEW.status);
    FOR recipient IN
      SELECT h.user_id FROM helpers h JOIN users u ON u.id=h.user_id
      WHERE u.is_active AND u.role IN ('helper','both') AND h.is_available AND h.user_id<>NEW.household_id
        AND (NEW.category_id IS NULL OR EXISTS(SELECT 1 FROM helper_categories hc WHERE hc.helper_id=h.id AND hc.category_id=NEW.category_id) OR EXISTS(SELECT 1 FROM helper_services hs WHERE hs.helper_id=h.id AND hs.category_id=NEW.category_id))
        AND NOT EXISTS(SELECT 1 FROM emergency_declines d WHERE d.request_id=NEW.id AND d.helper_id=h.id)
    LOOP
      PERFORM enqueue_notification(recipient,'emergency:'||NEW.id||':'||NEW.status,kind,heading,payload||jsonb_build_object('audience','helper'));
    END LOOP;
    PERFORM enqueue_notification(NEW.household_id,'emergency:'||NEW.id||':'||NEW.status,CASE WHEN TG_OP='INSERT' THEN 'emergency_created' ELSE kind END,heading,payload||jsonb_build_object('audience','household'));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path=pg_catalog,public;

REVOKE ALL ON FUNCTION clear_stale_location() FROM PUBLIC;
