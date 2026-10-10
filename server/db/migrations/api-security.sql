-- Review before applying to existing Supabase. Express owns Auth (integer IDs).
-- No direct anon/authenticated Data API consumer is supported by this application.
-- Owners/service_role retain access; no permissive RLS policies are added.
DO $$ DECLARE relation TEXT; role_name TEXT; routine TEXT; BEGIN
  FOREACH relation IN ARRAY ARRAY['users','helpers','categories','helper_categories','helper_services','bookings','jobs','job_applications','conversations','messages','reviews','payments','complaints','ai_messages','emergency_requests','emergency_declines','notifications','push_devices','push_deliveries','media_uploads','sync_revisions','helpearly_schema'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',relation);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',relation,role_name); END IF;
    END LOOP;
  END LOOP;
  FOREACH routine IN ARRAY ARRAY['refresh_worker_rating()','enqueue_notification(integer,text,text,text,jsonb)','marketplace_notification()','expire_emergency_notifications()','bump_sync(text,integer)','marketplace_sync()'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||routine||' FROM PUBLIC';
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.'||routine||format(' FROM %I',role_name); END IF;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',role_name);
    END IF;
  END LOOP;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
END; $$;
