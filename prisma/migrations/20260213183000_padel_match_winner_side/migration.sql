DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelMatchSide'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelMatchSide" AS ENUM (
      'A',
      'B'
    );
  END IF;
END $$;

ALTER TABLE app_v3.padel_matches
  ADD COLUMN IF NOT EXISTS winner_side app_v3."PadelMatchSide";

UPDATE app_v3.padel_matches
SET winner_side = CASE UPPER(COALESCE(score->>'winnerSide', ''))
  WHEN 'A' THEN 'A'::app_v3."PadelMatchSide"
  WHEN 'B' THEN 'B'::app_v3."PadelMatchSide"
  ELSE winner_side
END
WHERE winner_side IS NULL;

UPDATE app_v3.padel_matches
SET winner_side = CASE
  WHEN winner_pairing_id IS NOT NULL AND winner_pairing_id = pairing_a_id THEN 'A'::app_v3."PadelMatchSide"
  WHEN winner_pairing_id IS NOT NULL AND winner_pairing_id = pairing_b_id THEN 'B'::app_v3."PadelMatchSide"
  ELSE winner_side
END
WHERE winner_side IS NULL;
