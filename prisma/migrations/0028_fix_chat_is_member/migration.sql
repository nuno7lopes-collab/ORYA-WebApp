CREATE OR REPLACE FUNCTION app_v3.chat_is_member(thread_id uuid, user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_v3.chat_members m
    WHERE m.thread_id = $1
      AND m.user_id = $2
      AND m.left_at IS NULL
      AND m.banned_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app_v3, public;
