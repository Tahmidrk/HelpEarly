-- LOCAL CANDIDATE ONLY. Production requires verified backup/restore and approval.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE helper_services ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(100) NOT NULL,
  outcome VARCHAR(20) NOT NULL CHECK(outcome IN ('SUCCESS','REJECTED','DENIED','FAILED')),
  request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_audit_actor_time ON admin_audit_logs(actor_id,created_at DESC);
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_audit_logs FROM PUBLIC;
REVOKE ALL ON SEQUENCE admin_audit_logs_id_seq FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON admin_audit_logs FROM %I',r);
      EXECUTE format('REVOKE ALL ON SEQUENCE admin_audit_logs_id_seq FROM %I',r);
    END IF;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION protect_admin_audit() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Administrative audit is append-only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS immutable_admin_audit ON admin_audit_logs;
CREATE TRIGGER immutable_admin_audit BEFORE UPDATE OR DELETE OR TRUNCATE ON admin_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION protect_admin_audit();
CREATE OR REPLACE FUNCTION protect_last_admin() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.role='admin' AND OLD.is_active AND (TG_OP='DELETE' OR NEW.role<>'admin' OR NOT NEW.is_active) THEN
    PERFORM pg_advisory_xact_lock(724033);
    IF NOT EXISTS(SELECT 1 FROM users WHERE role='admin' AND is_active AND id<>OLD.id FOR UPDATE) THEN
      RAISE EXCEPTION 'Cannot remove the last active administrator' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS last_admin_guard ON users;
CREATE TRIGGER last_admin_guard BEFORE UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION protect_last_admin();
CREATE OR REPLACE FUNCTION refresh_worker_rating() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE helpers SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE helper_id=COALESCE(NEW.helper_id,OLD.helper_id) AND NOT is_hidden),
    total_reviews=(SELECT COUNT(*) FROM reviews WHERE helper_id=COALESCE(NEW.helper_id,OLD.helper_id) AND NOT is_hidden)
    WHERE id=COALESCE(NEW.helper_id,OLD.helper_id);
  RETURN NULL;
END $$;
UPDATE helpers h SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE helper_id=h.id AND NOT is_hidden),
  total_reviews=(SELECT COUNT(*) FROM reviews WHERE helper_id=h.id AND NOT is_hidden)
WHERE h.avg_rating IS DISTINCT FROM (SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE helper_id=h.id AND NOT is_hidden)
   OR h.total_reviews IS DISTINCT FROM (SELECT COUNT(*) FROM reviews WHERE helper_id=h.id AND NOT is_hidden);
-- Reuse existing marketplace sync for ordinary resources; extend admin recovery.
CREATE OR REPLACE FUNCTION central_admin_sync() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  PERFORM bump_sync('admin');
  IF TG_TABLE_NAME='categories' THEN
    PERFORM bump_sync('helpers'); PERFORM bump_sync('jobs');
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['categories','helper_services','helper_categories','job_applications','emergency_requests','admin_audit_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS central_admin_changes ON %I',t);
    EXECUTE format('CREATE TRIGGER central_admin_changes AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION central_admin_sync()',t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION protect_admin_audit(),protect_last_admin(),central_admin_sync() FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION protect_admin_audit(),protect_last_admin(),central_admin_sync() FROM %I',r);
    END IF;
  END LOOP;
END $$;
INSERT INTO helpearly_schema(version) VALUES(3) ON CONFLICT DO NOTHING;
