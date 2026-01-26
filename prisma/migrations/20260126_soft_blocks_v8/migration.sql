DO $$ BEGIN
  CREATE TYPE app_v3."SoftBlockScope" AS ENUM ('ORGANIZATION','PROFESSIONAL','RESOURCE','COURT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'SOFT_BLOCK';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'HARD_BLOCK';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app_v3.soft_blocks (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL,
  scope_type app_v3."SoftBlockScope" NOT NULL DEFAULT 'ORGANIZATION',
  scope_id integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE app_v3.soft_blocks
    ADD CONSTRAINT soft_blocks_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS soft_blocks_org_idx
  ON app_v3.soft_blocks (organization_id);

CREATE INDEX IF NOT EXISTS soft_blocks_scope_idx
  ON app_v3.soft_blocks (organization_id, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS soft_blocks_org_start_idx
  ON app_v3.soft_blocks (organization_id, starts_at);
