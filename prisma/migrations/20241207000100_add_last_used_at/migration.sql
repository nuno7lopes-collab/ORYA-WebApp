-- Add last_used_at to organizer_members
ALTER TABLE app_v3.organizer_members
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NULL;

-- Index to speed up selection by user ordering by last_used_at
CREATE INDEX IF NOT EXISTS organizer_members_user_last_used_idx
  ON app_v3.organizer_members (user_id, last_used_at DESC, created_at ASC);
