CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
SET search_path TO app_v3, public, extensions;

ALTER TABLE app_v3.events
  ADD COLUMN IF NOT EXISTS invite_only boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_v3.event_invites (
  id serial PRIMARY KEY,
  event_id integer NOT NULL,
  invited_by_user_id uuid NOT NULL,
  target_identifier citext NOT NULL,
  target_user_id uuid,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT event_invites_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT event_invites_invited_by_fk FOREIGN KEY (invited_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT event_invites_target_user_fk FOREIGN KEY (target_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS event_invites_event_identifier_uq
  ON app_v3.event_invites(event_id, target_identifier);
CREATE INDEX IF NOT EXISTS event_invites_event_idx
  ON app_v3.event_invites(event_id);
CREATE INDEX IF NOT EXISTS event_invites_target_idx
  ON app_v3.event_invites(target_user_id);
