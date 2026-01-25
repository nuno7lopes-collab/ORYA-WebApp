ALTER TABLE app_v3.notifications
  ADD COLUMN IF NOT EXISTS source_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_event_id_unique
  ON app_v3.notifications (source_event_id);
