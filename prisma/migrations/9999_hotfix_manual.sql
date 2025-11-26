DO $$ BEGIN
  CREATE TYPE "app_v3"."Visibility" AS ENUM ('PUBLIC','PRIVATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "app_v3"."EventCategoryType" AS ENUM ('FESTA','DESPORTO','CONCERTO','PALESTRA','ARTE','COMIDA','DRINKS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Profiles additions
ALTER TABLE "app_v3"."profiles"
  ADD COLUMN IF NOT EXISTS "visibility" "app_v3"."Visibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "allow_email_notifications" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allow_event_reminders" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allow_friend_requests" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

-- Events soft delete
ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

-- Event categories pivot
CREATE TABLE IF NOT EXISTS "app_v3"."event_categories" (
  "id" serial PRIMARY KEY,
  "event_id" integer NOT NULL,
  "category" "app_v3"."EventCategoryType" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_categories_event_fk FOREIGN KEY ("event_id") REFERENCES "app_v3"."events" ("id") ON DELETE CASCADE,
  CONSTRAINT event_categories_unique UNIQUE ("event_id", "category")
);
CREATE INDEX IF NOT EXISTS event_categories_category_idx ON "app_v3"."event_categories" ("category");

