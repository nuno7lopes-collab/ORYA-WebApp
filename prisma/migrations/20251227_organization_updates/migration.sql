DO $$ BEGIN
  CREATE TYPE "app_v3"."OrganizationUpdateCategory" AS ENUM ('TODAY', 'CHANGES', 'RESULTS', 'CALL_UPS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app_v3"."OrganizationUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app_v3"."organization_updates" (
  "id" SERIAL PRIMARY KEY,
  "organizer_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "category" "app_v3"."OrganizationUpdateCategory" NOT NULL DEFAULT 'TODAY',
  "status" "app_v3"."OrganizationUpdateStatus" NOT NULL DEFAULT 'DRAFT',
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "organization_updates_organizer_fk" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_updates_event_fk" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "organization_updates_organizer_id_idx" ON "app_v3"."organization_updates" ("organizer_id");
CREATE INDEX IF NOT EXISTS "organization_updates_event_id_idx" ON "app_v3"."organization_updates" ("event_id");
CREATE INDEX IF NOT EXISTS "organization_updates_status_idx" ON "app_v3"."organization_updates" ("status");
