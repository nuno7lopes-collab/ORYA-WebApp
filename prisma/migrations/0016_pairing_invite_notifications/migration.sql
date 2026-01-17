DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PAIRING_INVITE'
      AND enumtypid = 'app_v3."NotificationType"'::regtype
  ) THEN
    ALTER TYPE app_v3."NotificationType" ADD VALUE 'PAIRING_INVITE';
  END IF;
END $$;
