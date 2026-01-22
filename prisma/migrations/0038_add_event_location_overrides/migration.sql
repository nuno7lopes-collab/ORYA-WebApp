ALTER TABLE app_v3.events
  ADD COLUMN IF NOT EXISTS location_overrides jsonb;
