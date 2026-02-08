-- Notification preferences (granular categories)
ALTER TABLE app_v3.notification_preferences
  ADD COLUMN IF NOT EXISTS allow_social_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_event_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_system_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_marketing_notifications boolean NOT NULL DEFAULT true;

-- Notification mutes
CREATE TABLE IF NOT EXISTS app_v3.notification_mutes (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id integer,
  event_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_mutes_target_chk CHECK (organization_id IS NOT NULL OR event_id IS NOT NULL),
  CONSTRAINT notification_mutes_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT notification_mutes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT notification_mutes_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT notification_mutes_user_org_event_uq UNIQUE (user_id, organization_id, event_id)
);

CREATE INDEX IF NOT EXISTS notification_mutes_user_idx ON app_v3.notification_mutes(user_id);
CREATE INDEX IF NOT EXISTS notification_mutes_org_idx ON app_v3.notification_mutes(organization_id);
CREATE INDEX IF NOT EXISTS notification_mutes_event_idx ON app_v3.notification_mutes(event_id);
CREATE INDEX IF NOT EXISTS notification_mutes_env_idx ON app_v3.notification_mutes(env);

ALTER TABLE app_v3.notification_mutes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'app_v3' AND tablename = 'notification_mutes' AND policyname = 'env_isolation'
  ) THEN
    CREATE POLICY env_isolation ON app_v3.notification_mutes
      USING (env = current_setting('app.env', true))
      WITH CHECK (env = current_setting('app.env', true));
  END IF;
END $$;
