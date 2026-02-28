ALTER TABLE app_v3.events
  ADD COLUMN IF NOT EXISTS consumes_resources boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_v3.event_resources (
  id serial PRIMARY KEY,
  event_id int NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  scope_type app_v3."AvailabilityScopeType" NOT NULL,
  scope_id int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_resources_event_scope_unique UNIQUE (event_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS event_resources_event_idx
  ON app_v3.event_resources (event_id);

CREATE INDEX IF NOT EXISTS event_resources_scope_idx
  ON app_v3.event_resources (scope_type, scope_id);
