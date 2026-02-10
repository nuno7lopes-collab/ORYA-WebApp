DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatEventInviteStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatEventInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatConversationContextType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatConversationContextType" AS ENUM (
      'ORG_CHANNEL',
      'ORG_CONTACT',
      'EVENT',
      'BOOKING',
      'SERVICE',
      'USER_DM',
      'USER_GROUP'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatConversationRequestStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatConversationRequestStatus" AS ENUM (
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatMemberDisplayAs' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatMemberDisplayAs" AS ENUM ('ORGANIZATION', 'PROFESSIONAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatChannelRequestStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatChannelRequestStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NotificationType' AND n.nspname = 'app_v3' AND e.enumlabel = 'CHAT_AVAILABLE'
  ) THEN
    ALTER TYPE app_v3."NotificationType" ADD VALUE 'CHAT_AVAILABLE';
  END IF;
END $$;

ALTER TABLE app_v3.chat_threads
  ALTER COLUMN delete_after DROP NOT NULL;

UPDATE app_v3.chat_threads
SET delete_after = NULL,
    updated_at = now()
WHERE delete_after IS NOT NULL;

ALTER TABLE app_v3.chat_members
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;

ALTER TABLE app_v3.chat_conversations
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS context_type app_v3."ChatConversationContextType";

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS context_id text;

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS customer_id uuid;

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS professional_id uuid;

UPDATE app_v3.chat_conversations
SET context_type = 'ORG_CHANNEL'
WHERE context_type IS NULL;

ALTER TABLE app_v3.chat_conversations
  ALTER COLUMN context_type SET NOT NULL;

ALTER TABLE app_v3.chat_conversations
  ADD CONSTRAINT chat_conversations_context_org_chk
  CHECK (
    (context_type IN ('ORG_CHANNEL','ORG_CONTACT','EVENT','BOOKING','SERVICE') AND organization_id IS NOT NULL)
    OR (context_type IN ('USER_DM','USER_GROUP') AND organization_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS chat_conversations_context_idx
  ON app_v3.chat_conversations (context_type, context_id);
CREATE INDEX IF NOT EXISTS chat_conversations_customer_idx
  ON app_v3.chat_conversations (customer_id);
CREATE INDEX IF NOT EXISTS chat_conversations_professional_idx
  ON app_v3.chat_conversations (professional_id);

ALTER TABLE app_v3.chat_conversation_members
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE app_v3.chat_conversation_members
  ADD COLUMN IF NOT EXISTS display_as app_v3."ChatMemberDisplayAs" NOT NULL DEFAULT 'ORGANIZATION';

ALTER TABLE app_v3.chat_conversation_members
  ADD COLUMN IF NOT EXISTS hidden_from_customer boolean NOT NULL DEFAULT false;

ALTER TABLE app_v3.chat_conversation_messages
  ALTER COLUMN organization_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS app_v3.chat_event_invites (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES app_v3.entitlements(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  status app_v3."ChatEventInviteStatus" NOT NULL DEFAULT 'PENDING',
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_event_invites_event_entitlement_unique
  ON app_v3.chat_event_invites (event_id, entitlement_id);
CREATE INDEX IF NOT EXISTS chat_event_invites_user_status_idx
  ON app_v3.chat_event_invites (user_id, status);
CREATE INDEX IF NOT EXISTS chat_event_invites_thread_status_idx
  ON app_v3.chat_event_invites (thread_id, status);
CREATE INDEX IF NOT EXISTS chat_event_invites_status_idx
  ON app_v3.chat_event_invites (status);

ALTER TABLE app_v3.chat_event_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_event_invites_service_role ON app_v3.chat_event_invites
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS app_v3.chat_conversation_requests (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  target_organization_id integer REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  context_type app_v3."ChatConversationContextType" NOT NULL,
  status app_v3."ChatConversationRequestStatus" NOT NULL DEFAULT 'PENDING',
  conversation_id uuid REFERENCES app_v3.chat_conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_conversation_requests_requester_status_idx
  ON app_v3.chat_conversation_requests (requester_id, status);
CREATE INDEX IF NOT EXISTS chat_conversation_requests_target_user_status_idx
  ON app_v3.chat_conversation_requests (target_user_id, status);
CREATE INDEX IF NOT EXISTS chat_conversation_requests_target_org_status_idx
  ON app_v3.chat_conversation_requests (target_organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversation_requests_pending_unique
  ON app_v3.chat_conversation_requests (requester_id, target_user_id, context_type)
  WHERE status = 'PENDING';

ALTER TABLE app_v3.chat_conversation_requests
  ADD CONSTRAINT chat_conversation_requests_target_chk
  CHECK (
    (context_type = 'USER_DM' AND target_user_id IS NOT NULL)
    OR (context_type = 'ORG_CONTACT' AND target_organization_id IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS app_v3.chat_channel_requests (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  status app_v3."ChatChannelRequestStatus" NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chat_channel_requests_org_status_idx
  ON app_v3.chat_channel_requests (organization_id, status);
CREATE INDEX IF NOT EXISTS chat_channel_requests_requester_status_idx
  ON app_v3.chat_channel_requests (requester_id, status);

DROP POLICY IF EXISTS chat_threads_select_participants ON app_v3.chat_threads;
CREATE POLICY chat_threads_select_participants ON app_v3.chat_threads
  FOR SELECT TO authenticated
  USING (
    app_v3.chat_is_member(id, auth.uid())
  );

DROP POLICY IF EXISTS chat_messages_select ON app_v3.chat_messages;
CREATE POLICY chat_messages_select ON app_v3.chat_messages
  FOR SELECT TO authenticated
  USING (
    app_v3.is_platform_admin(auth.uid())
    OR app_v3.chat_is_org_actor(thread_id, auth.uid())
    OR app_v3.chat_is_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS chat_messages_insert_participant ON app_v3.chat_messages;
CREATE POLICY chat_messages_insert_participant ON app_v3.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'USER'
    AND user_id = auth.uid()
    AND app_v3.chat_is_member(thread_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM app_v3.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.status = 'OPEN'
    )
    AND NOT EXISTS (
      SELECT 1 FROM app_v3.chat_members m
      WHERE m.thread_id = chat_messages.thread_id
        AND m.user_id = auth.uid()
        AND m.access_revoked_at IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM app_v3.chat_members m
      WHERE m.thread_id = chat_messages.thread_id
        AND m.user_id = auth.uid()
        AND m.muted_until IS NOT NULL
        AND m.muted_until > now()
    )
  );


CREATE OR REPLACE FUNCTION app_v3.chat_ensure_event_thread(event_id integer)
RETURNS uuid AS $$
DECLARE
  v_event record;
  v_thread_id uuid;
  v_open timestamptz;
  v_read timestamptz;
  v_close timestamptz;
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
    NULL,
    app_v3.chat_compute_status(v_open, v_read, v_close)
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        open_at = EXCLUDED.open_at,
        read_only_at = EXCLUDED.read_only_at,
        close_at = EXCLUDED.close_at,
        delete_after = NULL,
        status = app_v3.chat_compute_status(EXCLUDED.open_at, EXCLUDED.read_only_at, EXCLUDED.close_at),
        updated_at = now()
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

UPDATE app_v3.chat_threads
SET delete_after = NULL,
    updated_at = now()
WHERE entity_type = 'EVENT';

DROP TRIGGER IF EXISTS chat_ticket_sync ON app_v3.tickets;
DROP TRIGGER IF EXISTS chat_tournament_entry_sync ON app_v3.tournament_entries;
DROP TRIGGER IF EXISTS chat_booking_sync ON app_v3.bookings;
