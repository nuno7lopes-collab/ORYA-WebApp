DO $$ BEGIN
  CREATE TYPE app_v3."PadelClubKind" AS ENUM ('OWN', 'PARTNER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE app_v3.padel_clubs
  ADD COLUMN IF NOT EXISTS kind app_v3."PadelClubKind" NOT NULL DEFAULT 'OWN',
  ADD COLUMN IF NOT EXISTS source_club_id integer,
  ADD COLUMN IF NOT EXISTS location_source app_v3."LocationSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS location_provider_id text,
  ADD COLUMN IF NOT EXISTS location_formatted_address text,
  ADD COLUMN IF NOT EXISTS location_components jsonb,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
