DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'match_notifications'
  ) THEN
    CREATE TABLE app_v3.match_notifications (
      id serial PRIMARY KEY,
      match_id integer NOT NULL,
      dedupe_key text NOT NULL,
      created_at timestamptz(6) DEFAULT now(),
      payload jsonb,
      UNIQUE (dedupe_key)
    );
    CREATE INDEX match_notifications_match_idx ON app_v3.match_notifications (match_id);
  END IF;
END $$;
