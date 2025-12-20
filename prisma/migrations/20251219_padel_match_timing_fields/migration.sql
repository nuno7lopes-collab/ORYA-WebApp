-- Add scheduling fields to padel matches for proper calendar operations
ALTER TABLE "app_v3"."padel_matches"
  ADD COLUMN IF NOT EXISTS "court_id" integer,
  ADD COLUMN IF NOT EXISTS "planned_start_at" timestamptz(6),
  ADD COLUMN IF NOT EXISTS "planned_end_at" timestamptz(6),
  ADD COLUMN IF NOT EXISTS "planned_duration_minutes" integer,
  ADD COLUMN IF NOT EXISTS "actual_start_at" timestamptz(6),
  ADD COLUMN IF NOT EXISTS "actual_end_at" timestamptz(6);

-- FK to courts (nullable, so existing data is safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'padel_matches_court_fk'
  ) THEN
    ALTER TABLE "app_v3"."padel_matches"
      ADD CONSTRAINT "padel_matches_court_fk"
      FOREIGN KEY ("court_id") REFERENCES "app_v3"."padel_club_courts"("id")
      ON UPDATE NO ACTION
      ON DELETE SET NULL;
  END IF;
END$$;

-- Helpful index for court lookups
CREATE INDEX IF NOT EXISTS "padel_matches_court_idx" ON "app_v3"."padel_matches" ("court_id");

