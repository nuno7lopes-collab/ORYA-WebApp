ALTER TABLE app_v3.bookings
  ADD COLUMN IF NOT EXISTS court_snapshot_name TEXT,
  ADD COLUMN IF NOT EXISTS court_snapshot_cover_image_url TEXT;
