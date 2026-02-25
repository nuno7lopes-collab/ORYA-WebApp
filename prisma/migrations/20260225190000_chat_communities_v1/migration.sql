-- Chat communities v1

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'ChatConversationContextType'
      AND e.enumlabel = 'ORG_COMMUNITY'
  ) THEN
    ALTER TYPE app_v3."ChatConversationContextType" ADD VALUE 'ORG_COMMUNITY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'ChatAccessGrantKind'
      AND e.enumlabel = 'COMMUNITY_INVITE'
  ) THEN
    ALTER TYPE app_v3."ChatAccessGrantKind" ADD VALUE 'COMMUNITY_INVITE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'ChatAccessGrantKind'
      AND e.enumlabel = 'COMMUNITY_JOIN_REQUEST'
  ) THEN
    ALTER TYPE app_v3."ChatAccessGrantKind" ADD VALUE 'COMMUNITY_JOIN_REQUEST';
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE app_v3."ChatCommunityTalkPolicy" AS ENUM ('EVERYONE', 'TEAM_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE app_v3."ChatCommunityAccessMode" AS ENUM ('PUBLIC', 'FOLLOWERS', 'APPROVAL', 'INVITE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app_v3.chat_conversation_members
  ADD COLUMN IF NOT EXISTS write_muted_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS write_muted_until timestamptz(6),
  ADD COLUMN IF NOT EXISTS write_muted_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS follow_grace_ends_at timestamptz(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_conversation_members_write_muted_by_fk'
  ) THEN
    ALTER TABLE app_v3.chat_conversation_members
      ADD CONSTRAINT chat_conversation_members_write_muted_by_fk
      FOREIGN KEY (write_muted_by_user_id)
      REFERENCES app_v3.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_conversation_members_follow_grace_idx
  ON app_v3.chat_conversation_members (follow_grace_ends_at);

CREATE TABLE IF NOT EXISTS app_v3.chat_communities (
  env text NOT NULL DEFAULT 'prod',
  conversation_id uuid PRIMARY KEY,
  organization_id integer NOT NULL,
  title text NOT NULL,
  description text,
  cover_image_url text,
  talk_policy app_v3."ChatCommunityTalkPolicy" NOT NULL DEFAULT 'EVERYONE',
  access_mode app_v3."ChatCommunityAccessMode" NOT NULL DEFAULT 'PUBLIC',
  created_by_user_id uuid,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chat_communities_conversation_fk
    FOREIGN KEY (conversation_id)
    REFERENCES app_v3.chat_conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT chat_communities_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT chat_communities_created_by_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES app_v3.profiles(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chat_communities_org_idx
  ON app_v3.chat_communities (organization_id);

CREATE INDEX IF NOT EXISTS chat_communities_org_access_mode_idx
  ON app_v3.chat_communities (organization_id, access_mode);

CREATE TABLE IF NOT EXISTS app_v3.chat_community_invite_links (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  token_hash text NOT NULL,
  created_by_user_id uuid,
  expires_at timestamptz(6),
  revoked_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chat_community_invite_links_conversation_fk
    FOREIGN KEY (conversation_id)
    REFERENCES app_v3.chat_communities(conversation_id)
    ON DELETE CASCADE,
  CONSTRAINT chat_community_invite_links_created_by_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES app_v3.profiles(id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_community_invite_links_token_hash_unique
  ON app_v3.chat_community_invite_links (token_hash);

CREATE INDEX IF NOT EXISTS chat_community_invite_links_conversation_idx
  ON app_v3.chat_community_invite_links (conversation_id);

CREATE INDEX IF NOT EXISTS chat_community_invite_links_conversation_revoked_idx
  ON app_v3.chat_community_invite_links (conversation_id, revoked_at);

CREATE INDEX IF NOT EXISTS chat_access_grants_kind_status_conversation_idx
  ON app_v3.chat_access_grants (kind, status, conversation_id);
