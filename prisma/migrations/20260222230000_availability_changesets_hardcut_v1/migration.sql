DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityChangeSetStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityChangeSetStatus" AS ENUM ('PENDING', 'READY_TO_APPLY', 'APPLIED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityConflictStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityConflictStatus" AS ENUM ('OPEN', 'RESOLVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityConflictEntityType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityConflictEntityType" AS ENUM ('BOOKING', 'CLASS_SESSION');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityConflictResolutionAction' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityConflictResolutionAction" AS ENUM ('RESCHEDULED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.availability_change_sets (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  scope_type app_v3."AvailabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  scope_id INTEGER NOT NULL DEFAULT 0,
  schedule_id INTEGER,
  status app_v3."AvailabilityChangeSetStatus" NOT NULL DEFAULT 'PENDING',
  requested_by_user_id UUID,
  draft_payload JSONB NOT NULL,
  preflight_summary JSONB,
  applied_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_change_sets_org_fk
    FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT availability_change_sets_schedule_fk
    FOREIGN KEY (schedule_id)
    REFERENCES app_v3.availability_schedules(id)
    ON DELETE SET NULL,
  CONSTRAINT availability_change_sets_requested_by_fk
    FOREIGN KEY (requested_by_user_id)
    REFERENCES app_v3.profiles(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS availability_change_sets_org_status_idx
  ON app_v3.availability_change_sets(organization_id, status);
CREATE INDEX IF NOT EXISTS availability_change_sets_org_scope_idx
  ON app_v3.availability_change_sets(organization_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS availability_change_sets_created_idx
  ON app_v3.availability_change_sets(created_at);

CREATE TABLE IF NOT EXISTS app_v3.availability_change_conflicts (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  change_set_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  status app_v3."AvailabilityConflictStatus" NOT NULL DEFAULT 'OPEN',
  entity_type app_v3."AvailabilityConflictEntityType" NOT NULL,
  entity_id INTEGER NOT NULL,
  scope_type app_v3."AvailabilityScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  scope_id INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason_code TEXT,
  resolution_action app_v3."AvailabilityConflictResolutionAction",
  resolved_at TIMESTAMPTZ,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_change_conflicts_set_fk
    FOREIGN KEY (change_set_id)
    REFERENCES app_v3.availability_change_sets(id)
    ON DELETE CASCADE,
  CONSTRAINT availability_change_conflicts_org_fk
    FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS availability_change_conflicts_set_status_idx
  ON app_v3.availability_change_conflicts(change_set_id, status);
CREATE INDEX IF NOT EXISTS availability_change_conflicts_org_status_idx
  ON app_v3.availability_change_conflicts(organization_id, status);
CREATE INDEX IF NOT EXISTS availability_change_conflicts_entity_idx
  ON app_v3.availability_change_conflicts(entity_type, entity_id);

WITH ranked_overrides AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, scope_type, scope_id, date
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM app_v3.availability_overrides
)
DELETE FROM app_v3.availability_overrides o
USING ranked_overrides r
WHERE o.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS app_v3.availability_overrides_org_scope_date_idx;

ALTER TABLE app_v3.availability_overrides
  DROP CONSTRAINT IF EXISTS availability_override_scope_date_unique;

ALTER TABLE app_v3.availability_overrides
  ADD CONSTRAINT availability_override_scope_date_unique
  UNIQUE (organization_id, scope_type, scope_id, date);

ALTER TABLE app_v3.bookings
  DROP CONSTRAINT IF EXISTS bookings_availability_id_fkey;

DROP INDEX IF EXISTS app_v3.bookings_availability_id_idx;

ALTER TABLE app_v3.bookings
  DROP COLUMN IF EXISTS availability_id;

DROP TABLE IF EXISTS app_v3.availabilities CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityStatus' AND n.nspname = 'app_v3'
  ) THEN
    DROP TYPE app_v3."AvailabilityStatus";
  END IF;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    NULL;
END $$;
