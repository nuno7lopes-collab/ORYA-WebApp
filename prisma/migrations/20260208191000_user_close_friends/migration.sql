CREATE TABLE IF NOT EXISTS app_v3.user_close_friends (
  env text NOT NULL DEFAULT 'prod',
  user_id uuid NOT NULL,
  friend_user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT user_close_friends_pkey PRIMARY KEY (user_id, friend_user_id),
  CONSTRAINT user_close_friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_close_friends_friend_id_fkey FOREIGN KEY (friend_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_close_friends_user_exp_idx
  ON app_v3.user_close_friends(user_id, expires_at);

CREATE INDEX IF NOT EXISTS user_close_friends_friend_idx
  ON app_v3.user_close_friends(friend_user_id);

CREATE INDEX IF NOT EXISTS padel_community_comments_author_time_idx
  ON app_v3.padel_community_comments(author_user_id, created_at);

CREATE INDEX IF NOT EXISTS padel_community_reactions_user_time_idx
  ON app_v3.padel_community_reactions(user_id, created_at);

CREATE INDEX IF NOT EXISTS entitlements_owner_user_start_idx
  ON app_v3.entitlements(owner_user_id, snapshot_start_at);

ALTER TABLE app_v3.user_close_friends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'app_v3' AND tablename = 'user_close_friends' AND policyname = 'env_isolation'
  ) THEN
    CREATE POLICY env_isolation ON app_v3.user_close_friends
      USING (env = current_setting('app.env', true))
      WITH CHECK (env = current_setting('app.env', true));
  END IF;
END $$;
