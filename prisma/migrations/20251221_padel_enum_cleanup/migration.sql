-- Normalize enums: remove SPORT/DESPORTO in favor of PADEL only
-- 1) Rename old enums
ALTER TYPE "app_v3"."EventCategoryType" RENAME TO "EventCategoryType_old";
ALTER TYPE "app_v3"."EventTemplateType" RENAME TO "EventTemplateType_old";

-- 2) Create new enums with desired values
CREATE TYPE "app_v3"."EventCategoryType" AS ENUM ('FESTA', 'PADEL', 'CONCERTO', 'PALESTRA', 'ARTE', 'COMIDA', 'DRINKS');
CREATE TYPE "app_v3"."EventTemplateType" AS ENUM ('PARTY', 'PADEL', 'VOLUNTEERING', 'TALK', 'OTHER');

-- 3) Re-type columns to the new enums with explicit mapping
ALTER TABLE "app_v3"."event_categories"
  ALTER COLUMN "category" TYPE "app_v3"."EventCategoryType"
  USING (
    CASE
      WHEN "category"::text = 'DESPORTO' THEN 'PADEL'
      ELSE "category"::text
    END
  )::"app_v3"."EventCategoryType";

ALTER TABLE "app_v3"."events"
  ALTER COLUMN "template_type" TYPE "app_v3"."EventTemplateType"
  USING (
    CASE
      WHEN "template_type"::text = 'SPORT' THEN 'PADEL'
      ELSE "template_type"::text
    END
  )::"app_v3"."EventTemplateType";

-- 4) Drop old enums
DROP TYPE "app_v3"."EventCategoryType_old";
DROP TYPE "app_v3"."EventTemplateType_old";
