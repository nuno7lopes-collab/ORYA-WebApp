DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ReservationAssignmentMode' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ReservationAssignmentMode" AS ENUM ('PROFESSIONAL', 'RESOURCE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityScopeType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityScopeType" AS ENUM ('ORGANIZATION', 'PROFESSIONAL', 'RESOURCE');
  END IF;
END $$;

ALTER TABLE app_v3.organizations
  ADD COLUMN IF NOT EXISTS reservation_assignment_mode app_v3."ReservationAssignmentMode" NOT NULL DEFAULT 'PROFESSIONAL';

CREATE TABLE IF NOT EXISTS app_v3.reservation_professionals (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  user_id UUID,
  name TEXT NOT NULL,
  role_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reservation_professionals_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT reservation_professionals_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS reservation_professionals_org_idx
  ON app_v3.reservation_professionals (organization_id);
CREATE INDEX IF NOT EXISTS reservation_professionals_active_idx
  ON app_v3.reservation_professionals (organization_id, is_active);
CREATE INDEX IF NOT EXISTS reservation_professionals_user_idx
  ON app_v3.reservation_professionals (user_id);

CREATE TABLE IF NOT EXISTS app_v3.reservation_resources (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reservation_resources_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS reservation_resources_org_idx
  ON app_v3.reservation_resources (organization_id);
CREATE INDEX IF NOT EXISTS reservation_resources_active_idx
  ON app_v3.reservation_resources (organization_id, is_active);
CREATE INDEX IF NOT EXISTS reservation_resources_capacity_idx
  ON app_v3.reservation_resources (capacity);

ALTER TABLE app_v3.weekly_availability_templates
  ADD COLUMN IF NOT EXISTS scope_type app_v3."AvailabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN IF NOT EXISTS scope_id INTEGER NOT NULL DEFAULT 0;

ALTER TABLE app_v3.availability_overrides
  ADD COLUMN IF NOT EXISTS scope_type app_v3."AvailabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN IF NOT EXISTS scope_id INTEGER NOT NULL DEFAULT 0;

ALTER TABLE app_v3.availability_overrides
  ALTER COLUMN intervals DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_availability_org_day_unique'
  ) THEN
    ALTER TABLE app_v3.weekly_availability_templates
      DROP CONSTRAINT weekly_availability_org_day_unique;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_availability_scope_day_unique'
  ) THEN
    ALTER TABLE app_v3.weekly_availability_templates
      ADD CONSTRAINT weekly_availability_scope_day_unique
      UNIQUE (organization_id, scope_type, scope_id, day_of_week);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS weekly_availability_templates_scope_idx
  ON app_v3.weekly_availability_templates (organization_id, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS availability_overrides_scope_idx
  ON app_v3.availability_overrides (organization_id, scope_type, scope_id, date);

ALTER TABLE app_v3.bookings
  ADD COLUMN IF NOT EXISTS assignment_mode app_v3."ReservationAssignmentMode" NOT NULL DEFAULT 'PROFESSIONAL',
  ADD COLUMN IF NOT EXISTS professional_id INTEGER,
  ADD COLUMN IF NOT EXISTS resource_id INTEGER,
  ADD COLUMN IF NOT EXISTS party_size INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_professional_fk'
  ) THEN
    ALTER TABLE app_v3.bookings
      ADD CONSTRAINT bookings_professional_fk
      FOREIGN KEY (professional_id) REFERENCES app_v3.reservation_professionals(id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_resource_fk'
  ) THEN
    ALTER TABLE app_v3.bookings
      ADD CONSTRAINT bookings_resource_fk
      FOREIGN KEY (resource_id) REFERENCES app_v3.reservation_resources(id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_professional_idx
  ON app_v3.bookings (professional_id);
CREATE INDEX IF NOT EXISTS bookings_resource_idx
  ON app_v3.bookings (resource_id);
CREATE INDEX IF NOT EXISTS bookings_party_size_idx
  ON app_v3.bookings (party_size);
