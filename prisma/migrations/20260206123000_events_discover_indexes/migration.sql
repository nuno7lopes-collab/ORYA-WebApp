-- Speed up Discover queries
CREATE INDEX IF NOT EXISTS events_status_deleted_starts_idx
  ON app_v3.events (status, is_deleted, starts_at);

CREATE INDEX IF NOT EXISTS events_status_deleted_ends_idx
  ON app_v3.events (status, is_deleted, ends_at);

CREATE INDEX IF NOT EXISTS organizations_status_idx
  ON app_v3.organizations (status);
