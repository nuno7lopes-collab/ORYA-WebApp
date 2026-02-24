-- Group-level public visibility for linked organizations in profile header/section.
ALTER TABLE "app_v3"."organization_groups"
ADD COLUMN IF NOT EXISTS "show_linked_organizations_publicly" BOOLEAN NOT NULL DEFAULT TRUE;
