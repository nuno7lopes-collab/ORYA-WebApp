DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'padel_match_status'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3' AND t.typname = 'padel_match_status' AND e.enumlabel = 'DONE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3' AND t.typname = 'padel_match_status' AND e.enumlabel = 'OFFICIAL'
    ) THEN
      ALTER TYPE app_v3.padel_match_status RENAME VALUE 'DONE' TO 'OFFICIAL';
    END IF;
  END IF;
END
$$;

ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'RESULT_SUBMITTED';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'PENDING_REVIEW_EXPIRED';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'OFFICIAL';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'WALKOVER';
ALTER TYPE app_v3.padel_match_status ADD VALUE IF NOT EXISTS 'RETIRED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'padel_result_validation_mode'
  ) THEN
    CREATE TYPE app_v3.padel_result_validation_mode AS ENUM (
      'IMMEDIATE_OFFICIAL',
      'IMMEDIATE_PENDING_THEN_OFFICIAL'
    );
  END IF;
END
$$;

ALTER TABLE app_v3.padel_tournament_configs
  ADD COLUMN IF NOT EXISTS result_validation_mode app_v3.padel_result_validation_mode,
  ADD COLUMN IF NOT EXISTS pending_confirmation_window_minutes integer,
  ADD COLUMN IF NOT EXISTS player_result_submission_enabled boolean;

UPDATE app_v3.padel_tournament_configs
SET
  result_validation_mode = COALESCE(
    CASE
      WHEN upper(trim(COALESCE(advanced_settings ->> 'resultValidationMode', ''))) = 'IMMEDIATE_PENDING_THEN_OFFICIAL'
        THEN 'IMMEDIATE_PENDING_THEN_OFFICIAL'::app_v3.padel_result_validation_mode
      WHEN upper(trim(COALESCE(advanced_settings ->> 'resultValidationMode', ''))) = 'IMMEDIATE_OFFICIAL'
        THEN 'IMMEDIATE_OFFICIAL'::app_v3.padel_result_validation_mode
      ELSE NULL
    END,
    'IMMEDIATE_OFFICIAL'::app_v3.padel_result_validation_mode
  ),
  pending_confirmation_window_minutes = CASE
    WHEN (advanced_settings ->> 'pendingConfirmationWindowMinutes') ~ '^[0-9]{1,3}$'
      THEN GREATEST(1, LEAST(120, (advanced_settings ->> 'pendingConfirmationWindowMinutes')::integer))
    ELSE 15
  END,
  player_result_submission_enabled = CASE
    WHEN lower(COALESCE(advanced_settings ->> 'playerResultSubmissionEnabled', '')) = 'true' THEN true
    WHEN lower(COALESCE(advanced_settings ->> 'playerResultSubmissionEnabled', '')) = 'false' THEN false
    ELSE false
  END
WHERE
  result_validation_mode IS NULL
  OR pending_confirmation_window_minutes IS NULL
  OR player_result_submission_enabled IS NULL;

ALTER TABLE app_v3.padel_tournament_configs
  ALTER COLUMN result_validation_mode SET DEFAULT 'IMMEDIATE_OFFICIAL'::app_v3.padel_result_validation_mode,
  ALTER COLUMN result_validation_mode SET NOT NULL,
  ALTER COLUMN pending_confirmation_window_minutes SET DEFAULT 15,
  ALTER COLUMN pending_confirmation_window_minutes SET NOT NULL,
  ALTER COLUMN player_result_submission_enabled SET DEFAULT false,
  ALTER COLUMN player_result_submission_enabled SET NOT NULL;

UPDATE app_v3.padel_matches
SET status = 'DISPUTED'::text::app_v3.padel_match_status
WHERE status::text = 'OFFICIAL'
  AND COALESCE(score ->> 'disputeStatus', '') = 'OPEN';

UPDATE app_v3.padel_matches
SET status = 'WALKOVER'::text::app_v3.padel_match_status
WHERE status::text = 'OFFICIAL'
  AND (
    upper(COALESCE(score ->> 'resultType', '')) = 'WALKOVER'
    OR lower(COALESCE(score ->> 'walkover', 'false')) = 'true'
  );

UPDATE app_v3.padel_matches
SET status = 'RETIRED'::text::app_v3.padel_match_status
WHERE status::text = 'OFFICIAL'
  AND upper(COALESCE(score ->> 'resultType', '')) IN ('RETIREMENT', 'INJURY');
