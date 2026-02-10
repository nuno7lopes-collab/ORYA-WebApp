-- Add soft-delete to courts
ALTER TABLE "app_v3"."padel_club_courts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

-- Add resource/professional scope fields to agenda items
ALTER TABLE "app_v3"."agenda_items" ADD COLUMN IF NOT EXISTS "resource_id" integer;
ALTER TABLE "app_v3"."agenda_items" ADD COLUMN IF NOT EXISTS "professional_id" integer;

-- Indexes for scope filtering
CREATE INDEX IF NOT EXISTS "agenda_items_org_resource_start_idx" ON "app_v3"."agenda_items" ("organization_id", "resource_id", "starts_at");
CREATE INDEX IF NOT EXISTS "agenda_items_org_professional_start_idx" ON "app_v3"."agenda_items" ("organization_id", "professional_id", "starts_at");
