DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='app_v3' AND t.typname='PublicApiScope') THEN
    CREATE TYPE app_v3."PublicApiScope" AS ENUM (
      'EVENTS_READ',
      'TOURNAMENTS_READ',
      'AGENDA_READ',
      'ANALYTICS_READ',
      'OPS_READ'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.public_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes app_v3."PublicApiScope"[] NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_api_keys_org_idx ON app_v3.public_api_keys(organization_id);
