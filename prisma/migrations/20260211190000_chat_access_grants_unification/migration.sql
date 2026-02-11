-- Unified messaging grants/contracts baseline

DO $$
BEGIN
  CREATE TYPE app_v3."ChatAccessGrantKind" AS ENUM (
    'EVENT_INVITE',
    'USER_DM_REQUEST',
    'ORG_CONTACT_REQUEST',
    'SERVICE_REQUEST',
    'CHANNEL_CREATE_REQUEST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE app_v3."ChatAccessGrantStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED',
    'EXPIRED',
    'REVOKED',
    'AUTO_ACCEPTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'ChatConversationMessageKind'
      AND e.enumlabel = 'ANNOUNCEMENT'
  ) THEN
    ALTER TYPE app_v3."ChatConversationMessageKind" ADD VALUE 'ANNOUNCEMENT';
  END IF;
END $$;

ALTER TABLE app_v3.chat_conversation_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS open_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS read_only_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS close_at timestamptz(6);

ALTER TABLE app_v3.chat_conversation_members
  ADD COLUMN IF NOT EXISTS left_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS banned_at timestamptz(6);

CREATE TABLE IF NOT EXISTS app_v3.chat_access_grants (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind app_v3."ChatAccessGrantKind" NOT NULL,
  status app_v3."ChatAccessGrantStatus" NOT NULL DEFAULT 'PENDING',
  context_type app_v3."ChatConversationContextType",
  context_id text,
  conversation_id uuid,
  organization_id integer,
  requester_id uuid,
  target_user_id uuid,
  target_organization_id integer,
  event_id integer,
  entitlement_id uuid,
  thread_id uuid,
  title text,
  source_table text,
  source_id uuid,
  expires_at timestamptz(6),
  resolved_at timestamptz(6),
  resolved_by_user_id uuid,
  accepted_at timestamptz(6),
  declined_at timestamptz(6),
  cancelled_at timestamptz(6),
  revoked_at timestamptz(6),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_access_grants_status_idx
  ON app_v3.chat_access_grants (status);

CREATE INDEX IF NOT EXISTS chat_access_grants_kind_status_idx
  ON app_v3.chat_access_grants (kind, status);

CREATE INDEX IF NOT EXISTS chat_access_grants_requester_status_idx
  ON app_v3.chat_access_grants (requester_id, status);

CREATE INDEX IF NOT EXISTS chat_access_grants_target_user_status_idx
  ON app_v3.chat_access_grants (target_user_id, status);

CREATE INDEX IF NOT EXISTS chat_access_grants_target_org_status_idx
  ON app_v3.chat_access_grants (target_organization_id, status);

CREATE INDEX IF NOT EXISTS chat_access_grants_context_idx
  ON app_v3.chat_access_grants (context_type, context_id);

CREATE UNIQUE INDEX IF NOT EXISTS chat_access_grants_source_unique
  ON app_v3.chat_access_grants (source_table, source_id);

CREATE INDEX IF NOT EXISTS chat_access_grants_conversation_idx
  ON app_v3.chat_access_grants (conversation_id);

CREATE INDEX IF NOT EXISTS chat_access_grants_event_idx
  ON app_v3.chat_access_grants (event_id);

UPDATE app_v3.chat_conversations c
SET
  open_at = COALESCE(c.open_at, t.open_at),
  read_only_at = COALESCE(c.read_only_at, t.read_only_at),
  close_at = COALESCE(c.close_at, t.close_at)
FROM app_v3.chat_threads t
WHERE c.context_id = t.entity_id::text
  AND (
    (c.context_type = 'EVENT' AND t.entity_type = 'EVENT')
    OR (c.context_type = 'BOOKING' AND t.entity_type = 'BOOKING')
  )
  AND (
    c.organization_id IS NULL
    OR c.organization_id = t.organization_id
  );

INSERT INTO app_v3.chat_access_grants (
  kind,
  status,
  context_type,
  context_id,
  event_id,
  entitlement_id,
  target_user_id,
  thread_id,
  source_table,
  source_id,
  expires_at,
  accepted_at,
  revoked_at,
  created_at,
  updated_at,
  metadata
)
SELECT
  'EVENT_INVITE'::app_v3."ChatAccessGrantKind" AS kind,
  CASE i.status
    WHEN 'PENDING' THEN 'PENDING'::app_v3."ChatAccessGrantStatus"
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::app_v3."ChatAccessGrantStatus"
    WHEN 'EXPIRED' THEN 'EXPIRED'::app_v3."ChatAccessGrantStatus"
    WHEN 'REVOKED' THEN 'REVOKED'::app_v3."ChatAccessGrantStatus"
    ELSE 'PENDING'::app_v3."ChatAccessGrantStatus"
  END AS status,
  'EVENT'::app_v3."ChatConversationContextType" AS context_type,
  i.event_id::text AS context_id,
  i.event_id,
  i.entitlement_id,
  i.user_id,
  i.thread_id,
  'chat_event_invites' AS source_table,
  i.id AS source_id,
  i.expires_at,
  i.accepted_at,
  i.revoked_at,
  i.created_at,
  i.updated_at,
  jsonb_build_object('legacyStatus', i.status)
FROM app_v3.chat_event_invites i
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  status = EXCLUDED.status,
  target_user_id = COALESCE(EXCLUDED.target_user_id, app_v3.chat_access_grants.target_user_id),
  expires_at = EXCLUDED.expires_at,
  accepted_at = EXCLUDED.accepted_at,
  revoked_at = EXCLUDED.revoked_at,
  updated_at = GREATEST(app_v3.chat_access_grants.updated_at, EXCLUDED.updated_at),
  metadata = EXCLUDED.metadata;

INSERT INTO app_v3.chat_access_grants (
  kind,
  status,
  context_type,
  context_id,
  conversation_id,
  organization_id,
  requester_id,
  target_user_id,
  target_organization_id,
  source_table,
  source_id,
  resolved_at,
  created_at,
  updated_at,
  metadata
)
SELECT
  CASE r.context_type
    WHEN 'USER_DM' THEN 'USER_DM_REQUEST'::app_v3."ChatAccessGrantKind"
    WHEN 'ORG_CONTACT' THEN 'ORG_CONTACT_REQUEST'::app_v3."ChatAccessGrantKind"
    WHEN 'SERVICE' THEN 'SERVICE_REQUEST'::app_v3."ChatAccessGrantKind"
    ELSE 'USER_DM_REQUEST'::app_v3."ChatAccessGrantKind"
  END AS kind,
  CASE r.status
    WHEN 'PENDING' THEN 'PENDING'::app_v3."ChatAccessGrantStatus"
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::app_v3."ChatAccessGrantStatus"
    WHEN 'DECLINED' THEN 'DECLINED'::app_v3."ChatAccessGrantStatus"
    WHEN 'EXPIRED' THEN 'EXPIRED'::app_v3."ChatAccessGrantStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::app_v3."ChatAccessGrantStatus"
    ELSE 'PENDING'::app_v3."ChatAccessGrantStatus"
  END AS status,
  r.context_type,
  r.context_id,
  r.conversation_id,
  r.target_organization_id,
  r.requester_id,
  r.target_user_id,
  r.target_organization_id,
  'chat_conversation_requests' AS source_table,
  r.id AS source_id,
  r.resolved_at,
  r.created_at,
  r.updated_at,
  jsonb_build_object('legacyStatus', r.status)
FROM app_v3.chat_conversation_requests r
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  status = EXCLUDED.status,
  conversation_id = COALESCE(EXCLUDED.conversation_id, app_v3.chat_access_grants.conversation_id),
  resolved_at = EXCLUDED.resolved_at,
  updated_at = GREATEST(app_v3.chat_access_grants.updated_at, EXCLUDED.updated_at),
  metadata = EXCLUDED.metadata;

INSERT INTO app_v3.chat_access_grants (
  kind,
  status,
  context_type,
  organization_id,
  requester_id,
  title,
  source_table,
  source_id,
  resolved_at,
  resolved_by_user_id,
  created_at,
  updated_at,
  metadata
)
SELECT
  'CHANNEL_CREATE_REQUEST'::app_v3."ChatAccessGrantKind" AS kind,
  CASE r.status
    WHEN 'PENDING' THEN 'PENDING'::app_v3."ChatAccessGrantStatus"
    WHEN 'APPROVED' THEN 'ACCEPTED'::app_v3."ChatAccessGrantStatus"
    WHEN 'REJECTED' THEN 'DECLINED'::app_v3."ChatAccessGrantStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::app_v3."ChatAccessGrantStatus"
    ELSE 'PENDING'::app_v3."ChatAccessGrantStatus"
  END AS status,
  'ORG_CHANNEL'::app_v3."ChatConversationContextType" AS context_type,
  r.organization_id,
  r.requester_id,
  r.title,
  'chat_channel_requests' AS source_table,
  r.id AS source_id,
  r.resolved_at,
  r.resolved_by_user_id,
  r.created_at,
  r.updated_at,
  jsonb_build_object('legacyStatus', r.status)
FROM app_v3.chat_channel_requests r
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  status = EXCLUDED.status,
  resolved_at = EXCLUDED.resolved_at,
  resolved_by_user_id = EXCLUDED.resolved_by_user_id,
  updated_at = GREATEST(app_v3.chat_access_grants.updated_at, EXCLUDED.updated_at),
  metadata = EXCLUDED.metadata;
