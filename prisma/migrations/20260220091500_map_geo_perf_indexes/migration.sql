-- Discover map performance indexes (btree only, no PostGIS in this phase)

CREATE INDEX IF NOT EXISTS addresses_lat_lng_idx
  ON app_v3.addresses (lat, lng);

CREATE INDEX IF NOT EXISTS events_status_deleted_starts_address_idx
  ON app_v3.events (status, is_deleted, starts_at, address_id);
