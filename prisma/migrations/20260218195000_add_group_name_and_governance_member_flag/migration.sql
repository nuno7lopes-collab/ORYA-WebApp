-- Add group display name and governance lock flags.

ALTER TABLE "app_v3"."organization_groups"
ADD COLUMN "name" TEXT;

ALTER TABLE "app_v3"."organization_group_members"
ADD COLUMN "is_governance" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill group name from first organization (fallbacks to Grupo #id).
UPDATE "app_v3"."organization_groups" g
SET "name" = COALESCE(src.public_name, src.business_name, 'Grupo #' || g.id::text)
FROM LATERAL (
  SELECT o."public_name" AS public_name, o."business_name" AS business_name
  FROM "app_v3"."organizations" o
  WHERE o."group_id" = g.id
  ORDER BY o.id ASC
  LIMIT 1
) src
WHERE g."name" IS NULL;

UPDATE "app_v3"."organization_groups"
SET "name" = 'Grupo #' || id::text
WHERE "name" IS NULL;
