DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'EventPricingMode'
  ) THEN
    CREATE TYPE app_v3."EventPricingMode" AS ENUM (
      'STANDARD',
      'FREE_ONLY'
    );
  END IF;
END $$;

ALTER TABLE app_v3.events
  ADD COLUMN IF NOT EXISTS pricing_mode app_v3."EventPricingMode" NOT NULL DEFAULT 'STANDARD';

UPDATE app_v3.events
SET pricing_mode = 'FREE_ONLY'
WHERE is_free = TRUE;
