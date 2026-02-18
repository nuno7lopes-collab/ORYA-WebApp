-- Create availability schedules and move weekly templates to schedule-based model.

CREATE TABLE IF NOT EXISTS app_v3.availability_schedules (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  scope_type app_v3."AvailabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  scope_id INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_schedules_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS availability_schedules_org_idx
  ON app_v3.availability_schedules(organization_id);
CREATE INDEX IF NOT EXISTS availability_schedules_org_scope_idx
  ON app_v3.availability_schedules(organization_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS availability_schedules_org_start_idx
  ON app_v3.availability_schedules(organization_id, start_date);

ALTER TABLE app_v3.weekly_availability_templates
  ADD COLUMN IF NOT EXISTS availability_id INTEGER;

INSERT INTO app_v3.availability_schedules (organization_id, scope_type, scope_id, start_date, end_date)
SELECT DISTINCT organization_id, scope_type, scope_id, CURRENT_DATE, NULL
FROM app_v3.weekly_availability_templates;

UPDATE app_v3.weekly_availability_templates t
SET availability_id = s.id
FROM app_v3.availability_schedules s
WHERE s.organization_id = t.organization_id
  AND s.scope_type = t.scope_type
  AND s.scope_id = t.scope_id
  AND t.availability_id IS NULL;

ALTER TABLE app_v3.weekly_availability_templates
  ALTER COLUMN availability_id SET NOT NULL;

ALTER TABLE app_v3.weekly_availability_templates
  DROP CONSTRAINT IF EXISTS weekly_availability_scope_day_unique;

ALTER TABLE app_v3.weekly_availability_templates
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS scope_type,
  DROP COLUMN IF EXISTS scope_id;

ALTER TABLE app_v3.weekly_availability_templates
  ADD CONSTRAINT availability_template_day_unique
  UNIQUE (availability_id, day_of_week);

CREATE INDEX IF NOT EXISTS weekly_availability_templates_availability_id_idx
  ON app_v3.weekly_availability_templates(availability_id);

ALTER TABLE app_v3.weekly_availability_templates
  ADD CONSTRAINT weekly_availability_templates_availability_id_fkey
  FOREIGN KEY (availability_id)
  REFERENCES app_v3.availability_schedules(id)
  ON DELETE CASCADE;
