DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='app_v3' AND table_name='notification_outbox'
  ) THEN
    CREATE TABLE app_v3.notification_outbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NULL,
      notification_type text NOT NULL,
      template_version text NULL,
      dedupe_key text NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      retries integer NOT NULL DEFAULT 0,
      last_error text NULL,
      created_at timestamptz(6) NOT NULL DEFAULT now(),
      sent_at timestamptz(6) NULL
    );
    CREATE UNIQUE INDEX notification_outbox_dedupe_idx ON app_v3.notification_outbox (dedupe_key);
    CREATE INDEX notification_outbox_status_idx ON app_v3.notification_outbox (status);
    CREATE INDEX notification_outbox_user_idx ON app_v3.notification_outbox (user_id);
  END IF;
END $$;
