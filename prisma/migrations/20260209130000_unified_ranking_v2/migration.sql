-- Add interest tags to events
ALTER TABLE "app_v3"."events" ADD COLUMN "interest_tags" text[] DEFAULT ARRAY[]::text[];

-- Add interest tags to search index items
ALTER TABLE "app_v3"."search_index_items" ADD COLUMN "interest_tags" text[] DEFAULT ARRAY[]::text[];

-- User event signals for personalization
CREATE TYPE "app_v3"."UserEventSignalType" AS ENUM (
  'CLICK',
  'VIEW',
  'DWELL',
  'FAVORITE',
  'PURCHASE',
  'HIDE_EVENT',
  'HIDE_CATEGORY',
  'HIDE_ORG'
);

CREATE TABLE "app_v3"."user_event_signals" (
  "env" text NOT NULL DEFAULT 'prod',
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "event_id" integer,
  "organization_id" integer,
  "signal_type" "app_v3"."UserEventSignalType" NOT NULL,
  "signal_value" integer,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_event_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_event_signals_user_time_idx" ON "app_v3"."user_event_signals" ("user_id", "created_at");
CREATE INDEX "user_event_signals_event_idx" ON "app_v3"."user_event_signals" ("event_id");
CREATE INDEX "user_event_signals_org_idx" ON "app_v3"."user_event_signals" ("organization_id");
CREATE INDEX "user_event_signals_type_idx" ON "app_v3"."user_event_signals" ("signal_type");

ALTER TABLE "app_v3"."user_event_signals"
  ADD CONSTRAINT "user_event_signals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_v3"."user_event_signals"
  ADD CONSTRAINT "user_event_signals_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_v3"."user_event_signals"
  ADD CONSTRAINT "user_event_signals_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
