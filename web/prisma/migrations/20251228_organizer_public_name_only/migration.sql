UPDATE "app_v3"."organizers"
SET "public_name" = COALESCE("public_name", "display_name", "business_name", "username", 'Organizacao ORYA')
WHERE "public_name" IS NULL;

ALTER TABLE "app_v3"."organizers"
  ALTER COLUMN "public_name" SET NOT NULL;

ALTER TABLE "app_v3"."organizers"
  DROP COLUMN "display_name";
