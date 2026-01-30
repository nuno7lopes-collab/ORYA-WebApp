CREATE INDEX "outbox_events_created_at_event_idx" ON "app_v3"."outbox_events"("created_at", "event_id");
