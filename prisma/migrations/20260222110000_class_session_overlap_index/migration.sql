CREATE INDEX IF NOT EXISTS class_sessions_org_court_start_end_idx
  ON app_v3.class_sessions(organization_id, court_id, starts_at, ends_at);
