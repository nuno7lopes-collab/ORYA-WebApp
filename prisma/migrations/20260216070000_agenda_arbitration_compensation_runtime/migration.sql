BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AgendaArbitrationCompensationStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AgendaArbitrationCompensationStatus" AS ENUM (
      'OPEN',
      'IN_PROGRESS',
      'SUCCEEDED',
      'FAILED'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AgendaArbitrationCompensationAttemptStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AgendaArbitrationCompensationAttemptStatus" AS ENUM (
      'SUCCEEDED',
      'FAILED_RETRYABLE',
      'FAILED_FINAL'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'agenda_arbitration_decisions'
      AND column_name = 'compensation_status'
  ) THEN
    ALTER TABLE app_v3.agenda_arbitration_decisions
      ALTER COLUMN compensation_status
      TYPE app_v3."AgendaArbitrationCompensationStatus"
      USING (
        CASE
          WHEN compensation_status IS NULL THEN NULL
          WHEN compensation_status::text IN ('OPEN', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED')
            THEN compensation_status::text::app_v3."AgendaArbitrationCompensationStatus"
          ELSE 'FAILED'::app_v3."AgendaArbitrationCompensationStatus"
        END
      );
  ELSE
    ALTER TABLE app_v3.agenda_arbitration_decisions
      ADD COLUMN compensation_status app_v3."AgendaArbitrationCompensationStatus" NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.agenda_arbitration_compensation_attempts (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  arbitration_decision_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  status app_v3."AgendaArbitrationCompensationAttemptStatus" NOT NULL,
  error_code text NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT agenda_arbitration_comp_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_arbitration_comp_attempts_decision_fk
    FOREIGN KEY (arbitration_decision_id) REFERENCES app_v3.agenda_arbitration_decisions(id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_arbitration_comp_attempts_unique
  ON app_v3.agenda_arbitration_compensation_attempts (arbitration_decision_id, attempt_no);

CREATE INDEX IF NOT EXISTS agenda_arbitration_comp_attempts_decision_idx
  ON app_v3.agenda_arbitration_compensation_attempts (arbitration_decision_id);

CREATE INDEX IF NOT EXISTS agenda_arbitration_comp_attempts_status_idx
  ON app_v3.agenda_arbitration_compensation_attempts (status);

COMMIT;
