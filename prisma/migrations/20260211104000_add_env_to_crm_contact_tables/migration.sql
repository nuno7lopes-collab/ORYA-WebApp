-- Ensure CRM contact tables support env-scoped Prisma extension filters.
ALTER TABLE IF EXISTS app_v3.crm_contacts
  ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT 'prod';

ALTER TABLE IF EXISTS app_v3.crm_contact_consents
  ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT 'prod';

ALTER TABLE IF EXISTS app_v3.crm_contact_notes
  ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT 'prod';

ALTER TABLE IF EXISTS app_v3.crm_contact_padel
  ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT 'prod';

CREATE INDEX IF NOT EXISTS crm_contacts_env_idx
  ON app_v3.crm_contacts (env);

CREATE INDEX IF NOT EXISTS crm_contact_consents_env_idx
  ON app_v3.crm_contact_consents (env);

CREATE INDEX IF NOT EXISTS crm_contact_notes_env_idx
  ON app_v3.crm_contact_notes (env);

CREATE INDEX IF NOT EXISTS crm_contact_padel_env_idx
  ON app_v3.crm_contact_padel (env);
