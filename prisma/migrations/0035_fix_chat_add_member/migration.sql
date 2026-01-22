DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_members_thread_user_unique'
      AND conrelid = 'app_v3.chat_members'::regclass
  ) THEN
    ALTER TABLE app_v3.chat_members
      ADD CONSTRAINT chat_members_thread_user_unique
      UNIQUE USING INDEX chat_members_thread_user_unique;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_v3.chat_add_member(thread_id uuid, user_id uuid, role app_v3."ChatMemberRole")
RETURNS void AS $$
BEGIN
  INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
  VALUES ($1, $2, $3, now())
  ON CONFLICT ON CONSTRAINT chat_members_thread_user_unique DO UPDATE
    SET role = EXCLUDED.role,
        left_at = NULL,
        updated_at = now()
  WHERE app_v3.chat_members.banned_at IS NULL;
END;
$$ LANGUAGE plpgsql;
