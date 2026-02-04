-- Extend reservation policies with reschedule + cancellation penalty controls.
-- Schema: app_v3

ALTER TABLE "app_v3"."organization_policies"
  ADD COLUMN IF NOT EXISTS "allow_cancellation" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cancellation_penalty_bps" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allow_reschedule" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reschedule_window_minutes" integer;

-- Backfill: default reschedule window mirrors cancellation window when present.
UPDATE "app_v3"."organization_policies"
SET "reschedule_window_minutes" = "cancellation_window_minutes"
WHERE "reschedule_window_minutes" IS NULL
  AND "cancellation_window_minutes" IS NOT NULL;

-- Guardrails.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_policies_cancellation_penalty_bps_chk'
  ) THEN
    ALTER TABLE "app_v3"."organization_policies"
      ADD CONSTRAINT "organization_policies_cancellation_penalty_bps_chk"
      CHECK ("cancellation_penalty_bps" >= 0 AND "cancellation_penalty_bps" <= 10000);
  END IF;
END $$;

