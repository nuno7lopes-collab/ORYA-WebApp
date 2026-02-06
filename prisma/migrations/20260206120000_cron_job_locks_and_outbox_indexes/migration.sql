-- Create cron job lock table
CREATE TABLE IF NOT EXISTS app_v3.cron_job_locks (
  job_key text NOT NULL,
  env text NOT NULL DEFAULT 'prod',
  locked_at timestamptz NOT NULL,
  locked_until timestamptz NOT NULL,
  locked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_key, env)
);

CREATE INDEX IF NOT EXISTS cron_job_locks_until_idx
  ON app_v3.cron_job_locks (locked_until);

-- Speed up pending outbox scans
CREATE INDEX IF NOT EXISTS outbox_events_pending_created_idx
  ON app_v3.outbox_events (created_at, event_id)
  WHERE published_at IS NULL AND dead_lettered_at IS NULL;
