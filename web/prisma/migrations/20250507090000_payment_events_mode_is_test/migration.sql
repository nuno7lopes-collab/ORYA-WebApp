-- Add PaymentMode enum and is_test flag to payment_events
DO $$
BEGIN
  CREATE TYPE app_v3."PaymentMode" AS ENUM ('LIVE', 'TEST');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE app_v3.payment_events
  ADD COLUMN IF NOT EXISTS mode app_v3."PaymentMode" NOT NULL DEFAULT 'LIVE';

ALTER TABLE app_v3.payment_events
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
