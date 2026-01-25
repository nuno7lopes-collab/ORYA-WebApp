DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LocationConsent' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."LocationConsent" AS ENUM ('PENDING', 'GRANTED', 'DENIED');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LocationGranularity' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."LocationGranularity" AS ENUM ('PRECISE', 'COARSE');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'UserLocationSource' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."UserLocationSource" AS ENUM ('GPS', 'WIFI', 'IP', 'MANUAL');
  END IF;
END$$;

ALTER TABLE app_v3.profiles
  ADD COLUMN IF NOT EXISTS location_consent app_v3."LocationConsent" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS location_granularity app_v3."LocationGranularity" NOT NULL DEFAULT 'COARSE',
  ADD COLUMN IF NOT EXISTS location_source app_v3."UserLocationSource" NULL,
  ADD COLUMN IF NOT EXISTS location_city text NULL,
  ADD COLUMN IF NOT EXISTS location_region text NULL,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz NULL;
