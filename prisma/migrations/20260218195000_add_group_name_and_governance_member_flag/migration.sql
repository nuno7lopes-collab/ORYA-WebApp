-- Add group display name and governance lock flags.

ALTER TABLE "app_v3"."organization_groups"
ADD COLUMN "name" TEXT;

ALTER TABLE "app_v3"."organization_group_members"
ADD COLUMN "is_governance" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill group name from first organization (fallback to Grupo #id).
UPDATE "app_v3"."organization_groups" g
SET "name" = COALESCE(
  (
    SELECT COALESCE(o."public_name", o."business_name")
    FROM "app_v3"."organizations" o
    WHERE o."group_id" = g.id
    ORDER BY o.id ASC
    LIMIT 1
  ),
  'Grupo #' || g.id::text
)
WHERE g."name" IS NULL;

-- Mark group owners as governance members and enforce global scope.
UPDATE "app_v3"."organization_group_members" m
SET "is_governance" = TRUE,
    "scope_all_orgs" = TRUE,
    "scope_org_ids" = '{}'
FROM "app_v3"."organization_groups" g
WHERE m."group_id" = g.id
  AND m."user_id" = g."owner_user_id";

-- Remove per-organization overrides for governance members.
DELETE FROM "app_v3"."organization_member_overrides" o
USING "app_v3"."organization_group_members" m
WHERE o."group_member_id" = m.id
  AND m."is_governance" = TRUE;
