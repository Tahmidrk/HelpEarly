CREATE TABLE IF NOT EXISTS media_uploads (
  key TEXT PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sync_revisions (
  resource TEXT NOT NULL,
  user_id INTEGER NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY(resource,user_id)
);
CREATE OR REPLACE FUNCTION bump_sync(resource_name TEXT, audience INTEGER DEFAULT 0) RETURNS VOID AS $$
BEGIN
  IF audience IS NULL THEN RETURN; END IF;
  INSERT INTO sync_revisions(resource,user_id) VALUES(resource_name,audience)
  ON CONFLICT(resource,user_id) DO UPDATE SET version=sync_revisions.version+1;
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION marketplace_sync() RETURNS TRIGGER AS $$
DECLARE item JSONB; worker INTEGER; participant RECORD;
BEGIN
  IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  item=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME IN ('users','helpers','helper_services','helper_categories','reviews') THEN
    PERFORM bump_sync('helpers');
    IF TG_TABLE_NAME='users' THEN PERFORM bump_sync('profile',(item->>'id')::INTEGER); END IF;
    IF TG_TABLE_NAME='helpers' THEN PERFORM bump_sync('profile',(item->>'user_id')::INTEGER); END IF;
  ELSIF TG_TABLE_NAME='categories' THEN PERFORM bump_sync('categories');
  ELSIF TG_TABLE_NAME IN ('jobs','job_applications') THEN PERFORM bump_sync('jobs');
  ELSIF TG_TABLE_NAME='bookings' THEN
    SELECT user_id INTO worker FROM helpers WHERE id=(item->>'helper_id')::INTEGER;
    PERFORM bump_sync('bookings',worker); PERFORM bump_sync('bookings',(item->>'user_id')::INTEGER);
  ELSIF TG_TABLE_NAME='conversations' THEN
    PERFORM bump_sync('messages',(item->>'user1_id')::INTEGER); PERFORM bump_sync('messages',(item->>'user2_id')::INTEGER);
  ELSIF TG_TABLE_NAME='messages' THEN
    FOR participant IN SELECT user1_id,user2_id FROM conversations WHERE id=(item->>'conversation_id')::INTEGER LOOP
      PERFORM bump_sync('messages',participant.user1_id); PERFORM bump_sync('messages',participant.user2_id);
    END LOOP;
  ELSIF TG_TABLE_NAME='complaints' THEN PERFORM bump_sync('complaints',(item->>'complainant_id')::INTEGER);
  ELSIF TG_TABLE_NAME='emergency_requests' THEN PERFORM bump_sync('emergency');
  ELSIF TG_TABLE_NAME='notifications' THEN PERFORM bump_sync('notifications',(item->>'user_id')::INTEGER);
  END IF;
  IF TG_TABLE_NAME IN ('users','helpers','bookings','jobs','complaints','reviews') THEN PERFORM bump_sync('admin'); END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
DO $$ DECLARE relation TEXT; BEGIN
  FOREACH relation IN ARRAY ARRAY['users','helpers','helper_services','helper_categories','reviews','categories','jobs','job_applications','bookings','messages','conversations','complaints','emergency_requests','notifications'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS sync_changes ON public.%I',relation);
    EXECUTE format('CREATE TRIGGER sync_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION marketplace_sync()',relation);
  END LOOP;
END; $$;
CREATE TABLE IF NOT EXISTS helpearly_schema (version INTEGER PRIMARY KEY);
INSERT INTO helpearly_schema(version) VALUES(2) ON CONFLICT DO NOTHING;
