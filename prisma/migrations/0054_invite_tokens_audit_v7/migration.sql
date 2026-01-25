ALTER TABLE IF EXISTS app_v3.invite_tokens
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

CREATE INDEX IF NOT EXISTS invite_tokens_created_by_idx
  ON app_v3.invite_tokens (created_by_user_id);
