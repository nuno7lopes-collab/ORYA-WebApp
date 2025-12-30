DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'LiveHubMode'
  ) THEN
    CREATE TYPE "app_v3"."LiveHubMode" AS ENUM ('DEFAULT', 'PREMIUM');
  END IF;
END$$;

ALTER TABLE "app_v3"."organizers"
  ADD COLUMN IF NOT EXISTS "live_hub_premium_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "live_hub_mode" "app_v3"."LiveHubMode" NOT NULL DEFAULT 'DEFAULT';

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "live_stream_url" text;

UPDATE "app_v3"."organizers"
  SET "live_hub_premium_enabled" = true
  WHERE "id" = 23;

UPDATE "app_v3"."events"
  SET "live_hub_mode" = 'PREMIUM'
  WHERE "organizer_id" = 23;
