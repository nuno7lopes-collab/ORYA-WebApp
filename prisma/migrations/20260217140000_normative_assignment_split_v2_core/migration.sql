DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'ReservationAssignmentMode'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'ReservationAssignmentMode'
        AND e.enumlabel = 'PROFESSIONAL'
    ) THEN
      ALTER TYPE app_v3."ReservationAssignmentMode"
        RENAME VALUE 'PROFESSIONAL' TO 'PROFESSIONAL_ONLY';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'ReservationAssignmentMode'
        AND e.enumlabel = 'RESOURCE'
    ) THEN
      ALTER TYPE app_v3."ReservationAssignmentMode"
        RENAME VALUE 'RESOURCE' TO 'RESOURCE_ONLY';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'ReservationAssignmentMode'
        AND e.enumlabel = 'PROFESSIONAL_AND_RESOURCE'
    ) THEN
      ALTER TYPE app_v3."ReservationAssignmentMode"
        ADD VALUE 'PROFESSIONAL_AND_RESOURCE';
    END IF;
  END IF;
END
$$;

ALTER TABLE app_v3.organizations
  ADD COLUMN IF NOT EXISTS org_reschedule_window_minutes integer;

UPDATE app_v3.organizations
SET org_reschedule_window_minutes = 240
WHERE org_reschedule_window_minutes IS NULL;

ALTER TABLE app_v3.organizations
  ALTER COLUMN org_reschedule_window_minutes SET DEFAULT 240;

ALTER TABLE app_v3.organizations
  ALTER COLUMN org_reschedule_window_minutes SET NOT NULL;

ALTER TABLE app_v3.organizations
  ALTER COLUMN reservation_assignment_mode SET DEFAULT 'PROFESSIONAL_ONLY';

ALTER TABLE app_v3.services
  ADD COLUMN IF NOT EXISTS assignment_mode app_v3."ReservationAssignmentMode";

UPDATE app_v3.services s
SET assignment_mode = CASE
  WHEN EXISTS (
    SELECT 1
    FROM app_v3.service_resources srl
    WHERE srl.service_id = s.id
  ) THEN 'RESOURCE_ONLY'::app_v3."ReservationAssignmentMode"
  WHEN EXISTS (
    SELECT 1
    FROM app_v3.service_professionals spl
    WHERE spl.service_id = s.id
  ) THEN 'PROFESSIONAL_ONLY'::app_v3."ReservationAssignmentMode"
  ELSE COALESCE(o.reservation_assignment_mode, 'PROFESSIONAL_ONLY'::app_v3."ReservationAssignmentMode")
END
FROM app_v3.organizations o
WHERE s.organization_id = o.id
  AND s.assignment_mode IS NULL;

UPDATE app_v3.services
SET assignment_mode = 'PROFESSIONAL_ONLY'::app_v3."ReservationAssignmentMode"
WHERE assignment_mode IS NULL;

ALTER TABLE app_v3.services
  ALTER COLUMN assignment_mode SET DEFAULT 'PROFESSIONAL_ONLY';

ALTER TABLE app_v3.services
  ALTER COLUMN assignment_mode SET NOT NULL;

ALTER TABLE app_v3.bookings
  ALTER COLUMN assignment_mode SET DEFAULT 'PROFESSIONAL_ONLY';

DO $$
DECLARE
  has_legacy boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'BookingSplitStatus'
      AND e.enumlabel IN ('COMPLETED', 'EXPIRED')
  )
  INTO has_legacy;

  IF has_legacy THEN
    DROP TYPE IF EXISTS app_v3."BookingSplitStatus_v2";

    CREATE TYPE app_v3."BookingSplitStatus_v2" AS ENUM (
      'OPEN',
      'SETTLING',
      'SETTLED',
      'CHARGE_FAILED',
      'DEBT_OPEN',
      'CANCELLED'
    );

    ALTER TABLE app_v3.booking_splits
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE app_v3.booking_splits
      ALTER COLUMN status TYPE app_v3."BookingSplitStatus_v2"
      USING (
        CASE
          WHEN status::text = 'OPEN' THEN 'OPEN'::app_v3."BookingSplitStatus_v2"
          WHEN status::text = 'CANCELLED' THEN 'CANCELLED'::app_v3."BookingSplitStatus_v2"
          WHEN status::text = 'COMPLETED' THEN 'SETTLED'::app_v3."BookingSplitStatus_v2"
          WHEN status::text = 'EXPIRED' AND rail_state::text = 'DEBT' THEN 'DEBT_OPEN'::app_v3."BookingSplitStatus_v2"
          WHEN status::text = 'EXPIRED' THEN 'CHARGE_FAILED'::app_v3."BookingSplitStatus_v2"
          ELSE 'OPEN'::app_v3."BookingSplitStatus_v2"
        END
      );

    DROP TYPE app_v3."BookingSplitStatus";
    ALTER TYPE app_v3."BookingSplitStatus_v2" RENAME TO "BookingSplitStatus";
  END IF;
END
$$;

ALTER TABLE app_v3.booking_splits
  ALTER COLUMN status SET DEFAULT 'OPEN';
