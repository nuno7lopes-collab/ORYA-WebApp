-- CRM padel-first tags: catálogo por clube com cor e defaults

CREATE TABLE IF NOT EXISTS app_v3.crm_tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#22D3EE',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_tag_definitions_org_fk') THEN
    ALTER TABLE app_v3.crm_tag_definitions
      ADD CONSTRAINT crm_tag_definitions_org_fk
      FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS crm_tag_definitions_org_slug_unique
  ON app_v3.crm_tag_definitions (organization_id, slug);

CREATE INDEX IF NOT EXISTS crm_tag_definitions_org_active_sort_idx
  ON app_v3.crm_tag_definitions (organization_id, is_active, sort_order);
