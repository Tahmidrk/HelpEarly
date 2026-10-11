-- Reviewed rollback, NEVER automatically executed. Run inside a transaction.
-- New columns and preserved history remain. Stop if opposite-role threads exist.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM conversations GROUP BY LEAST(user1_id,user2_id),GREATEST(user1_id,user2_id) HAVING COUNT(*)>1) THEN
  RAISE EXCEPTION 'Rollback blocked: multiple role threads exist. Keep schema 4 and fix forward; never delete messages.';
 END IF;
END $$;
DROP INDEX IF EXISTS public.conversation_role_pair;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='conversations_user1_id_user2_id_key' AND conrelid='conversations'::regclass) THEN
  ALTER TABLE conversations ADD CONSTRAINT conversations_user1_id_user2_id_key UNIQUE(user1_id,user2_id);
 END IF;
END $$;
DROP TRIGGER IF EXISTS clear_stale_location ON users;
CREATE OR REPLACE FUNCTION public.marketplace_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
    PERFORM enqueue_notification(recipient,'message:'||NEW.id,'message_new','New message',jsonb_build_object('conversation_id',NEW.conversation_id));
  ELSIF TG_TABLE_NAME='complaints' THEN
    IF NEW.status<>OLD.status OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      PERFORM enqueue_notification(NEW.complainant_id,'complaint:'||NEW.id||':'||NEW.updated_at,'complaint_updated','Complaint status updated',jsonb_build_object('complaint_id',NEW.id));
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
      WHERE u.is_active AND h.is_available AND h.user_id<>NEW.household_id
        AND (NEW.category_id IS NULL OR EXISTS(SELECT 1 FROM helper_categories hc WHERE hc.helper_id=h.id AND hc.category_id=NEW.category_id) OR EXISTS(SELECT 1 FROM helper_services hs WHERE hs.helper_id=h.id AND hs.category_id=NEW.category_id))
        AND NOT EXISTS(SELECT 1 FROM emergency_declines d WHERE d.request_id=NEW.id AND d.helper_id=h.id)
    LOOP
      PERFORM enqueue_notification(recipient,'emergency:'||NEW.id||':'||NEW.status,kind,heading,payload||jsonb_build_object('audience','helper'));
    END LOOP;
    PERFORM enqueue_notification(NEW.household_id,'emergency:'||NEW.id||':'||NEW.status,CASE WHEN TG_OP='INSERT' THEN 'emergency_created' ELSE kind END,heading,payload||jsonb_build_object('audience','household'));
  END IF;
  RETURN NEW;
END; $function$
;
DELETE FROM helpearly_schema WHERE version=4;
