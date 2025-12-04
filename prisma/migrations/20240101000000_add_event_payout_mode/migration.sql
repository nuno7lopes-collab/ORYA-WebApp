-- Add payout mode to events
CREATE TYPE "app_v3"."PayoutMode" AS ENUM ('ORGANIZER', 'PLATFORM');

ALTER TABLE "app_v3"."events"
  ADD COLUMN "payout_mode" "app_v3"."PayoutMode" NOT NULL DEFAULT 'ORGANIZER';
