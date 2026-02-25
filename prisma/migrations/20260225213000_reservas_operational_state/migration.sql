DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'app_v3'
      AND table_name = 'organization_settings'
  ) THEN
    ALTER TABLE app_v3.organization_settings
      ADD COLUMN IF NOT EXISTS booking_accept_new_reservations boolean;

    UPDATE app_v3.organization_settings
    SET booking_accept_new_reservations = true
    WHERE booking_accept_new_reservations IS NULL;

    ALTER TABLE app_v3.organization_settings
      ALTER COLUMN booking_accept_new_reservations SET DEFAULT true,
      ALTER COLUMN booking_accept_new_reservations SET NOT NULL;
  END IF;
END
$$;
