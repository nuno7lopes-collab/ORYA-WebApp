DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_snapshot_fields_consistent_ck'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.bookings
      ADD CONSTRAINT bookings_snapshot_fields_consistent_ck
      CHECK (
        (
          confirmation_snapshot IS NULL
          AND confirmation_snapshot_version IS NULL
          AND confirmation_snapshot_created_at IS NULL
        )
        OR
        (
          confirmation_snapshot IS NOT NULL
          AND confirmation_snapshot_version IS NOT NULL
          AND confirmation_snapshot_created_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_final_status_requires_snapshot_ck'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.bookings
      ADD CONSTRAINT bookings_final_status_requires_snapshot_ck
      CHECK (
        status NOT IN (
          'CONFIRMED'::app_v3."BookingStatus",
          'COMPLETED'::app_v3."BookingStatus",
          'NO_SHOW'::app_v3."BookingStatus",
          'DISPUTED'::app_v3."BookingStatus"
        )
        OR (
          confirmation_snapshot IS NOT NULL
          AND confirmation_snapshot_version IS NOT NULL
          AND confirmation_snapshot_created_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_snapshot_fields_consistent_ck'
      AND connamespace = 'app_v3'::regnamespace
      AND convalidated = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_v3.bookings
    WHERE
      (
        confirmation_snapshot IS NULL
        AND (
          confirmation_snapshot_version IS NOT NULL
          OR confirmation_snapshot_created_at IS NOT NULL
        )
      )
      OR (
        confirmation_snapshot IS NOT NULL
        AND (
          confirmation_snapshot_version IS NULL
          OR confirmation_snapshot_created_at IS NULL
        )
      )
  ) THEN
    ALTER TABLE app_v3.bookings
      VALIDATE CONSTRAINT bookings_snapshot_fields_consistent_ck;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_final_status_requires_snapshot_ck'
      AND connamespace = 'app_v3'::regnamespace
      AND convalidated = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_v3.bookings
    WHERE status IN (
      'CONFIRMED'::app_v3."BookingStatus",
      'COMPLETED'::app_v3."BookingStatus",
      'NO_SHOW'::app_v3."BookingStatus",
      'DISPUTED'::app_v3."BookingStatus"
    )
      AND (
        confirmation_snapshot IS NULL
        OR confirmation_snapshot_version IS NULL
        OR confirmation_snapshot_created_at IS NULL
      )
  ) THEN
    ALTER TABLE app_v3.bookings
      VALIDATE CONSTRAINT bookings_final_status_requires_snapshot_ck;
  END IF;
END $$;
