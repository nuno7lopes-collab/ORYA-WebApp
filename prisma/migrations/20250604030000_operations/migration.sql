-- Create enum for operation status
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER');

-- Operations table (ingest-only → worker)
CREATE TABLE "app_v3"."operations" (
    "id" SERIAL PRIMARY KEY,
    "operation_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ,
    "next_retry_at" TIMESTAMPTZ,
    "payload" JSONB DEFAULT '{}'::jsonb,
    "purchase_id" UUID,
    "payment_intent_id" TEXT,
    "stripe_event_id" TEXT,
    "event_id" INTEGER,
    "organizer_id" INTEGER,
    "pairing_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "operations_dedupe_key_unique" UNIQUE ("dedupe_key")
);

CREATE INDEX "operations_status_idx" ON "app_v3"."operations" ("status");
CREATE INDEX "operations_purchase_idx" ON "app_v3"."operations" ("purchase_id");
CREATE INDEX "operations_payment_intent_idx" ON "app_v3"."operations" ("payment_intent_id");
CREATE INDEX "operations_stripe_event_idx" ON "app_v3"."operations" ("stripe_event_id");
