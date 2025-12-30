ALTER TABLE app_v3.padel_clubs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE app_v3.padel_club_staff
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
