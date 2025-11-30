-- Add is_test flag to events for admin-only test events
ALTER TABLE "app_v3"."events"
ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT FALSE;
