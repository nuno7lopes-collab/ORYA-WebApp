-- EventLog: add explicit versioning + subject + causation
ALTER TABLE "app_v3"."event_logs" ADD COLUMN "event_version" text;
ALTER TABLE "app_v3"."event_logs" ADD COLUMN "subject_type" text;
ALTER TABLE "app_v3"."event_logs" ADD COLUMN "subject_id" text;
ALTER TABLE "app_v3"."event_logs" ADD COLUMN "causation_id" text;

UPDATE "app_v3"."event_logs"
SET "event_version" = '1.0.0'
WHERE "event_version" IS NULL;

UPDATE "app_v3"."event_logs"
SET "subject_type" = COALESCE("source_type"::text, 'SYSTEM')
WHERE "subject_type" IS NULL;

UPDATE "app_v3"."event_logs"
SET "subject_id" = COALESCE("source_id", "id"::text)
WHERE "subject_id" IS NULL;

UPDATE "app_v3"."event_logs"
SET "causation_id" = "id"::text
WHERE "causation_id" IS NULL;

ALTER TABLE "app_v3"."event_logs" ALTER COLUMN "event_version" SET NOT NULL;
ALTER TABLE "app_v3"."event_logs" ALTER COLUMN "subject_type" SET NOT NULL;
ALTER TABLE "app_v3"."event_logs" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "app_v3"."event_logs" ALTER COLUMN "causation_id" SET NOT NULL;

-- Media assets registry
CREATE TYPE "app_v3"."MediaOwnerType" AS ENUM ('USER', 'ORGANIZATION', 'SYSTEM');

CREATE TABLE "app_v3"."media_assets" (
  "env" text NOT NULL DEFAULT 'prod',
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" integer,
  "owner_type" "app_v3"."MediaOwnerType" NOT NULL,
  "owner_id" text NOT NULL,
  "uploaded_by_user_id" uuid,
  "scope" text NOT NULL,
  "bucket" text NOT NULL,
  "object_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "original_filename" text,
  "is_public" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "deleted_at" timestamptz(6),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_assets_org_time_idx" ON "app_v3"."media_assets" ("organization_id", "created_at");
CREATE INDEX "media_assets_owner_idx" ON "app_v3"."media_assets" ("owner_type", "owner_id");
CREATE UNIQUE INDEX "media_assets_bucket_path_unique" ON "app_v3"."media_assets" ("bucket", "object_path");

ALTER TABLE "app_v3"."media_assets"
  ADD CONSTRAINT "media_assets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
