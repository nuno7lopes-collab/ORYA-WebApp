DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTournamentLifecycleStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE "app_v3"."PadelTournamentLifecycleStatus" AS ENUM (
      'DRAFT',
      'PUBLISHED',
      'LOCKED',
      'LIVE',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END$$;

ALTER TABLE "app_v3"."padel_tournament_configs"
  ADD COLUMN IF NOT EXISTS "rule_set_version_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "team_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "lifecycle_status" "app_v3"."PadelTournamentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "live_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_at" TIMESTAMPTZ;
