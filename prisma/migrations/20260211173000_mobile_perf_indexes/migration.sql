-- Mobile responsiveness: speed up social feed/suggestions and notification cleanup paths.
CREATE INDEX IF NOT EXISTS notifications_user_type_sender_idx
  ON app_v3.notifications (user_id, type, from_user_id);

CREATE INDEX IF NOT EXISTS events_org_status_deleted_created_idx
  ON app_v3.events (organization_id, status, is_deleted, created_at DESC);

CREATE INDEX IF NOT EXISTS tickets_user_status_event_idx
  ON app_v3.tickets (user_id, status, event_id);
