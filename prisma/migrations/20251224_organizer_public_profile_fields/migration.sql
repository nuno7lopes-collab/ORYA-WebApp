ALTER TABLE "app_v3"."organizers"
  ADD COLUMN IF NOT EXISTS "public_website" TEXT,
  ADD COLUMN IF NOT EXISTS "public_description" TEXT,
  ADD COLUMN IF NOT EXISTS "public_hours" TEXT,
  ADD COLUMN IF NOT EXISTS "info_rules" TEXT,
  ADD COLUMN IF NOT EXISTS "info_faq" TEXT,
  ADD COLUMN IF NOT EXISTS "info_requirements" TEXT,
  ADD COLUMN IF NOT EXISTS "info_policies" TEXT,
  ADD COLUMN IF NOT EXISTS "info_location_notes" TEXT;
