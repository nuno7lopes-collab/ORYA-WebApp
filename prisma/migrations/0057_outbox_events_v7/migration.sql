CREATE TABLE IF NOT EXISTS app_v3.outbox_events (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NULL,
  causation_id text NULL,
  correlation_id text NULL,
  dead_lettered_at timestamptz NULL
);

ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS attempts integer;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS causation_id text;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE app_v3.outbox_events
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS outbox_events_publish_idx
  ON app_v3.outbox_events (published_at, next_attempt_at);
CREATE INDEX IF NOT EXISTS outbox_events_dead_letter_idx
  ON app_v3.outbox_events (dead_lettered_at);
