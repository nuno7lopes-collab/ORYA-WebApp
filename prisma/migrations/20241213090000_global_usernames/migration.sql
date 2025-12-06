-- Enable citext for case-insensitive usernames
CREATE EXTENSION IF NOT EXISTS citext;

-- Profiles: move username to citext to align with global namespace
ALTER TABLE app_v3.profiles
  ALTER COLUMN username TYPE citext USING username::citext;

-- Organizers: add username (citext) with unique constraint
ALTER TABLE app_v3.organizers
  ADD COLUMN IF NOT EXISTS username citext;

CREATE UNIQUE INDEX IF NOT EXISTS organizers_username_key
  ON app_v3.organizers (username)
  WHERE username IS NOT NULL;

-- Global namespace table
CREATE TABLE IF NOT EXISTS app_v3.global_usernames (
  username    citext PRIMARY KEY,
  owner_type  text        NOT NULL,
  owner_id    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS global_usernames_owner_unique
  ON app_v3.global_usernames (owner_type, owner_id);

-- Backfill handles that já existam nas tabelas atuais (ignora conflitos)
INSERT INTO app_v3.global_usernames (username, owner_type, owner_id)
SELECT username, 'user', id::text
FROM app_v3.profiles
WHERE username IS NOT NULL
ON CONFLICT (username) DO NOTHING;

INSERT INTO app_v3.global_usernames (username, owner_type, owner_id)
SELECT username, 'organizer', id::text
FROM app_v3.organizers
WHERE username IS NOT NULL
ON CONFLICT (username) DO NOTHING;
