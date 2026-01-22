DO $$ BEGIN
  CREATE TYPE app_v3."LocationSource" AS ENUM ('OSM', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE app_v3.events
  ADD COLUMN IF NOT EXISTS location_source app_v3."LocationSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS location_provider_id text,
  ADD COLUMN IF NOT EXISTS location_formatted_address text,
  ADD COLUMN IF NOT EXISTS location_components jsonb;
