CREATE TABLE IF NOT EXISTS app_v3.event_logs (
  id uuid PRIMARY KEY,
  organization_id integer NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  source_type app_v3."SourceType",
  source_id text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_logs_org_event_idempotency_unique
  ON app_v3.event_logs (organization_id, event_type, idempotency_key);
CREATE INDEX IF NOT EXISTS event_logs_org_time_idx
  ON app_v3.event_logs (organization_id, created_at);
CREATE INDEX IF NOT EXISTS event_logs_event_time_idx
  ON app_v3.event_logs (event_type, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_logs_org_fk'
  ) THEN
    ALTER TABLE app_v3.event_logs
      ADD CONSTRAINT event_logs_org_fk
      FOREIGN KEY (organization_id)
      REFERENCES app_v3.organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.activity_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  source_type app_v3."SourceType",
  source_id text,
  correlation_id text,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_feed_items_event_unique
  ON app_v3.activity_feed_items (event_id);
CREATE INDEX IF NOT EXISTS activity_feed_org_time_idx
  ON app_v3.activity_feed_items (organization_id, created_at);
CREATE INDEX IF NOT EXISTS activity_feed_org_type_idx
  ON app_v3.activity_feed_items (organization_id, event_type);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_feed_items_org_fk'
  ) THEN
    ALTER TABLE app_v3.activity_feed_items
      ADD CONSTRAINT activity_feed_items_org_fk
      FOREIGN KEY (organization_id)
      REFERENCES app_v3.organizations(id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_feed_items_event_fk'
  ) THEN
    ALTER TABLE app_v3.activity_feed_items
      ADD CONSTRAINT activity_feed_items_event_fk
      FOREIGN KEY (event_id)
      REFERENCES app_v3.event_logs(id)
      ON DELETE CASCADE;
  END IF;
END $$;
