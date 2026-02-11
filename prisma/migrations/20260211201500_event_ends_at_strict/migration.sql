-- One-shot hardening for Event schedule invariants.
UPDATE app_v3.events
SET ends_at = starts_at + interval '5 hours'
WHERE ends_at IS NULL OR ends_at <= starts_at;

ALTER TABLE app_v3.events
  ALTER COLUMN ends_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_ends_at_after_starts_at_check'
      AND conrelid = 'app_v3.events'::regclass
  ) THEN
    ALTER TABLE app_v3.events
      ADD CONSTRAINT events_ends_at_after_starts_at_check
      CHECK (ends_at > starts_at);
  END IF;
END $$;
