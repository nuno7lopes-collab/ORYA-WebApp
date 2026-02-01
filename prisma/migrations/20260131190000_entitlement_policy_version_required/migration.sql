UPDATE "app_v3"."entitlements" AS e
SET "policy_version_applied" = COALESCE(
  (SELECT MAX(p."policy_version") FROM "app_v3"."event_access_policies" AS p WHERE p."event_id" = e."event_id"),
  1
)
WHERE e."event_id" IS NOT NULL
  AND (e."policy_version_applied" IS NULL OR e."policy_version_applied" = 0);

ALTER TABLE "app_v3"."entitlements"
  ADD CONSTRAINT "entitlements_policy_version_required"
  CHECK ("event_id" IS NULL OR ("policy_version_applied" IS NOT NULL AND "policy_version_applied" > 0));
