ALTER TABLE IF EXISTS app_v3.notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_outbox_next_attempt_idx
  ON app_v3.notification_outbox (next_attempt_at);
