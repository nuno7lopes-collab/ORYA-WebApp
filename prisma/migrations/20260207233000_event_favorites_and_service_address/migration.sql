-- Add missing service address reference
ALTER TABLE app_v3.services
  ADD COLUMN IF NOT EXISTS address_id uuid;

CREATE INDEX IF NOT EXISTS services_address_idx ON app_v3.services(address_id);

ALTER TABLE app_v3.services
  ADD CONSTRAINT services_address_id_fkey
  FOREIGN KEY (address_id) REFERENCES app_v3.addresses(id)
  ON DELETE SET NULL;

-- Event favorites (mobile + web)
CREATE TABLE IF NOT EXISTS app_v3.event_favorites (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id integer NOT NULL,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_favorites_user_id_event_id_key UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS event_favorites_event_id_idx ON app_v3.event_favorites(event_id);
CREATE INDEX IF NOT EXISTS event_favorites_env_idx ON app_v3.event_favorites(env);

ALTER TABLE app_v3.event_favorites
  ADD CONSTRAINT event_favorites_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE app_v3.event_favorites
  ADD CONSTRAINT event_favorites_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES app_v3.events(id)
  ON DELETE CASCADE;

-- RLS env isolation for new table
ALTER TABLE app_v3.event_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'app_v3' AND tablename = 'event_favorites' AND policyname = 'env_isolation'
  ) THEN
    CREATE POLICY env_isolation ON app_v3.event_favorites
      USING (env = current_setting('app.env', true))
      WITH CHECK (env = current_setting('app.env', true));
  END IF;
END $$;
