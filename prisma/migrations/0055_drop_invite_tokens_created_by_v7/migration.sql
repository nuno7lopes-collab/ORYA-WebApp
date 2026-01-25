DROP INDEX IF EXISTS app_v3.invite_tokens_created_by_idx;
ALTER TABLE IF EXISTS app_v3.invite_tokens
  DROP COLUMN IF EXISTS created_by_user_id;
