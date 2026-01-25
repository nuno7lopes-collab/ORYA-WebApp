DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'payments'
      AND column_name = 'customer_identity_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE app_v3.payments
      ALTER COLUMN customer_identity_id DROP NOT NULL;
  END IF;
END $$;
