-- Remove legacy ticket used_at (consumption is tracked via EntitlementCheckin)
ALTER TABLE "app_v3"."tickets" DROP COLUMN IF EXISTS "used_at";

-- Normalize check-in result codes (remove REFUNDED, map to REVOKED)
CREATE TYPE "app_v3"."checkin_result_code_new" AS ENUM (
  'OK',
  'ALREADY_USED',
  'INVALID',
  'REVOKED',
  'SUSPENDED',
  'NOT_ALLOWED',
  'OUTSIDE_WINDOW'
);

ALTER TABLE "app_v3"."entitlement_checkins"
  ALTER COLUMN "result_code" TYPE "app_v3"."checkin_result_code_new"
  USING (
    CASE
      WHEN "result_code"::text = 'REFUNDED' THEN 'REVOKED'
      ELSE "result_code"::text
    END
  )::"app_v3"."checkin_result_code_new";

DROP TYPE "app_v3"."checkin_result_code";
ALTER TYPE "app_v3"."checkin_result_code_new" RENAME TO "checkin_result_code";
