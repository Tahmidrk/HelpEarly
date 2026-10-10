-- Additive, repeatable migration. Existing marketplace records are preserved.
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
UPDATE emergency_requests SET expires_at = created_at + INTERVAL '30 minutes' WHERE expires_at IS NULL;
ALTER TABLE emergency_requests ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes');
CREATE TABLE IF NOT EXISTS emergency_declines (
  request_id INTEGER REFERENCES emergency_requests(id) ON DELETE CASCADE,
  helper_id INTEGER REFERENCES helpers(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id, helper_id)
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS request_key VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_request_key ON bookings(user_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_active_schedule ON bookings(helper_id,booking_date,end_date) WHERE status IN ('pending','confirmed','in_progress');
CREATE TABLE IF NOT EXISTS push_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMP,
  socket_sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS notifications_user_created ON notifications(user_id,id DESC);
CREATE TABLE IF NOT EXISTS push_deliveries (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ticket','delivered','failed','unknown')),
  ticket_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(notification_id,device_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending ON push_deliveries(next_attempt_at) WHERE status IN ('pending','ticket');

CREATE OR REPLACE FUNCTION enqueue_notification(target INTEGER,event TEXT,kind TEXT,heading TEXT,payload JSONB) RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications(user_id,event_key,type,title,data)
  SELECT target,event,kind,heading,payload WHERE EXISTS(SELECT 1 FROM users WHERE id=target AND is_active=true)
  ON CONFLICT(user_id,event_key) DO NOTHING;
END; $$ LANGUAGE plpgsql;

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
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS booking_notifications ON bookings;
CREATE TRIGGER booking_notifications AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION marketplace_notification();
DROP TRIGGER IF EXISTS proposal_notifications ON job_applications;
CREATE TRIGGER proposal_notifications AFTER INSERT OR UPDATE ON job_applications FOR EACH ROW EXECUTE FUNCTION marketplace_notification();
DROP TRIGGER IF EXISTS message_notifications ON messages;
CREATE TRIGGER message_notifications AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION marketplace_notification();
DROP TRIGGER IF EXISTS complaint_notifications ON complaints;
CREATE TRIGGER complaint_notifications AFTER UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION marketplace_notification();
DROP TRIGGER IF EXISTS verification_notifications ON helpers;
CREATE TRIGGER verification_notifications AFTER UPDATE ON helpers FOR EACH ROW EXECUTE FUNCTION marketplace_notification();
DROP TRIGGER IF EXISTS emergency_notifications ON emergency_requests;
CREATE TRIGGER emergency_notifications AFTER INSERT OR UPDATE ON emergency_requests FOR EACH ROW EXECUTE FUNCTION marketplace_notification();

CREATE OR REPLACE FUNCTION expire_emergency_notifications() RETURNS VOID AS $$
DECLARE emergency RECORD; recipient INTEGER; payload JSONB;
BEGIN
  FOR emergency IN SELECT e.* FROM emergency_requests e
    WHERE e.status='pending' AND e.expires_at<=CURRENT_TIMESTAMP
      AND e.expires_at>CURRENT_TIMESTAMP-INTERVAL '1 day'
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=e.household_id AND n.event_key='emergency:'||e.id||':expired') LIMIT 100
  LOOP
    payload=jsonb_build_object('request_id',emergency.id,'status','expired');
    FOR recipient IN SELECT h.user_id FROM helpers h JOIN users u ON u.id=h.user_id
      WHERE u.is_active AND h.is_available AND h.user_id<>emergency.household_id
        AND (EXISTS(SELECT 1 FROM helper_categories hc WHERE hc.helper_id=h.id AND hc.category_id=emergency.category_id) OR EXISTS(SELECT 1 FROM helper_services hs WHERE hs.helper_id=h.id AND hs.category_id=emergency.category_id))
        AND NOT EXISTS(SELECT 1 FROM emergency_declines d WHERE d.request_id=emergency.id AND d.helper_id=h.id)
    LOOP
      PERFORM enqueue_notification(recipient,'emergency:'||emergency.id||':expired','emergency_expired','Emergency request expired',payload||jsonb_build_object('audience','helper'));
    END LOOP;
    PERFORM enqueue_notification(emergency.household_id,'emergency:'||emergency.id||':expired','emergency_expired','Emergency request expired',payload||jsonb_build_object('audience','household'));
  END LOOP;
END; $$ LANGUAGE plpgsql;
