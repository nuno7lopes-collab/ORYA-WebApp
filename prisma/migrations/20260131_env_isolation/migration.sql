-- Add env isolation column to all app_v3 tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'app_v3' LOOP
    EXECUTE format('ALTER TABLE app_v3.%I ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT ''prod'';', r.tablename);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON app_v3.%I (env);', 'env_idx_' || substr(md5(r.tablename), 1, 8), r.tablename);
  END LOOP;
END $$;

-- Optional: enable RLS + env policy for app_v3 tables (idempotent)
DO $$
DECLARE r record;
DECLARE policy_exists boolean;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'app_v3' LOOP
    EXECUTE format('ALTER TABLE app_v3.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'app_v3'
        AND tablename = r.tablename
        AND policyname = 'env_isolation'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY env_isolation ON app_v3.%I USING (env = current_setting(''app.env'', true)) WITH CHECK (env = current_setting(''app.env'', true));',
        r.tablename
      );
    END IF;
  END LOOP;
END $$;
