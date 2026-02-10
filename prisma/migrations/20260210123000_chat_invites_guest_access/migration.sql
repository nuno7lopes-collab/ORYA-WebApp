DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatInviteStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.chat_invites (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  event_id integer NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  owner_identity_id uuid REFERENCES app_v3.email_identities(id) ON DELETE CASCADE,
  status app_v3."ChatInviteStatus" NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_invites_target_chk CHECK (((user_id IS NOT NULL)::int + (owner_identity_id IS NOT NULL)::int) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_invites_thread_user_unique
  ON app_v3.chat_invites (thread_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS chat_invites_thread_identity_unique
  ON app_v3.chat_invites (thread_id, owner_identity_id);
CREATE INDEX IF NOT EXISTS chat_invites_event_idx
  ON app_v3.chat_invites (event_id);
CREATE INDEX IF NOT EXISTS chat_invites_user_idx
  ON app_v3.chat_invites (user_id);
CREATE INDEX IF NOT EXISTS chat_invites_identity_idx
  ON app_v3.chat_invites (owner_identity_id);
CREATE INDEX IF NOT EXISTS chat_invites_status_idx
  ON app_v3.chat_invites (status);
CREATE INDEX IF NOT EXISTS chat_invites_expires_idx
  ON app_v3.chat_invites (expires_at);

ALTER TABLE app_v3.chat_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_invites_service_role ON app_v3.chat_invites
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS app_v3.guest_ticket_access_tokens (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id text NOT NULL,
  event_id integer NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  guest_email citext NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_ticket_access_purchase_email_uq
  ON app_v3.guest_ticket_access_tokens (purchase_id, guest_email);
CREATE INDEX IF NOT EXISTS guest_ticket_access_event_idx
  ON app_v3.guest_ticket_access_tokens (event_id);
CREATE INDEX IF NOT EXISTS guest_ticket_access_email_idx
  ON app_v3.guest_ticket_access_tokens (guest_email);
CREATE INDEX IF NOT EXISTS guest_ticket_access_expires_idx
  ON app_v3.guest_ticket_access_tokens (expires_at);

ALTER TABLE app_v3.guest_ticket_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY guest_ticket_access_tokens_service_role ON app_v3.guest_ticket_access_tokens
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION app_v3.chat_ensure_event_thread(event_id integer)
RETURNS uuid AS $$
DECLARE
  v_event record;
  v_thread_id uuid;
  v_open timestamptz;
  v_read timestamptz;
  v_close timestamptz;
  v_delete timestamptz;
BEGIN
  SELECT id, organization_id, starts_at, ends_at
  INTO v_event
  FROM app_v3.events
  WHERE id = event_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_event.organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_open := v_event.starts_at;
  v_read := COALESCE(v_event.ends_at, v_event.starts_at);
  v_close := v_read + interval '24 hours';
  v_delete := v_read + interval '7 days';

  INSERT INTO app_v3.chat_threads (
    entity_type,
    entity_id,
    organization_id,
    open_at,
    read_only_at,
    close_at,
    delete_after,
    status
  ) VALUES (
    'EVENT',
    v_event.id,
    v_event.organization_id,
    v_open,
    v_read,
    v_close,
    v_delete,
    app_v3.chat_compute_status(v_open, v_read, v_close)
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        open_at = EXCLUDED.open_at,
        read_only_at = EXCLUDED.read_only_at,
        close_at = EXCLUDED.close_at,
        delete_after = EXCLUDED.delete_after,
        status = app_v3.chat_compute_status(EXCLUDED.open_at, EXCLUDED.read_only_at, EXCLUDED.close_at),
        updated_at = now()
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

UPDATE app_v3.chat_threads
SET delete_after = read_only_at + interval '7 days',
    updated_at = now()
WHERE entity_type = 'EVENT';

CREATE OR REPLACE FUNCTION app_v3.chat_handle_ticket_change()
RETURNS trigger AS $$
DECLARE
  v_user uuid;
  v_thread_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = OLD.status
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN
    RETURN NEW;
  END IF;

  v_user := COALESCE(NEW.owner_user_id, NEW.user_id);
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- No auto-add for event chat; invites + check-in decide access.
  IF NEW.status = 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_thread_id
  FROM app_v3.chat_threads
  WHERE entity_type = 'EVENT' AND entity_id = NEW.event_id;

  IF v_thread_id IS NOT NULL THEN
    UPDATE app_v3.chat_members
      SET left_at = now(),
          updated_at = now()
    WHERE thread_id = v_thread_id
      AND user_id = v_user
      AND left_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_tournament_entry_change()
RETURNS trigger AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'CONFIRMED' THEN
    RETURN NEW;
  ELSIF NEW.status = 'CANCELLED' THEN
    SELECT id INTO v_thread_id
    FROM app_v3.chat_threads
    WHERE entity_type = 'EVENT' AND entity_id = NEW.event_id;

    IF v_thread_id IS NOT NULL THEN
      UPDATE app_v3.chat_members
        SET left_at = now(),
            updated_at = now()
      WHERE thread_id = v_thread_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;
