-- Add outbox dedupe + claim fields
ALTER TABLE "app_v3"."outbox_events" ADD COLUMN "dedupe_key" TEXT;
ALTER TABLE "app_v3"."outbox_events" ADD COLUMN "claimed_at" TIMESTAMPTZ(6);
ALTER TABLE "app_v3"."outbox_events" ADD COLUMN "processing_token" UUID;

-- Backfill causation_id for legacy rows, then set dedupe_key to canonical (event_type:causation_id)
UPDATE "app_v3"."outbox_events"
SET "causation_id" = "event_id"
WHERE "causation_id" IS NULL;

UPDATE "app_v3"."outbox_events"
SET "dedupe_key" = "event_type" || ':' || "causation_id"
WHERE "dedupe_key" IS NULL;

ALTER TABLE "app_v3"."outbox_events" ALTER COLUMN "dedupe_key" SET NOT NULL;

CREATE UNIQUE INDEX "outbox_events_dedupe_key_unique" ON "app_v3"."outbox_events"("dedupe_key");
CREATE INDEX "outbox_events_claimed_idx" ON "app_v3"."outbox_events"("claimed_at");
