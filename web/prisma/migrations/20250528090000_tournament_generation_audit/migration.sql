-- Safe additions for tournament generation metadata + audit log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app_v3' AND table_name = 'tournaments' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE app_v3.tournaments ADD COLUMN generated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app_v3' AND table_name = 'tournaments' AND column_name = 'generated_by_user_id'
  ) THEN
    ALTER TABLE app_v3.tournaments ADD COLUMN generated_by_user_id uuid REFERENCES app_v3.profiles(id) ON UPDATE NO ACTION;
    CREATE INDEX IF NOT EXISTS tournaments_generated_by_user_idx ON app_v3.tournaments (generated_by_user_id);
  END IF;
END $$;

-- Audit log table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'tournament_audit_logs'
  ) THEN
    CREATE TABLE app_v3.tournament_audit_logs (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES app_v3.tournaments(id) ON DELETE CASCADE,
      user_id uuid REFERENCES app_v3.profiles(id) ON UPDATE NO ACTION,
      action text NOT NULL,
      payload_before jsonb,
      payload_after jsonb,
      created_at timestamptz(6) DEFAULT now()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tournament_audit_logs_tournament_idx ON app_v3.tournament_audit_logs (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_audit_logs_user_idx ON app_v3.tournament_audit_logs (user_id);
