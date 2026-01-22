-- Chat V2 (polling) schema updates

DO $$ BEGIN
  CREATE TYPE app_v3."ChatConversationNotificationLevel" AS ENUM ('ALL', 'MENTIONS_ONLY', 'OFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."ChatConversationMessageKind" AS ENUM ('TEXT', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE app_v3."ChatConversationType" ADD VALUE IF NOT EXISTS 'CHANNEL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app_v3.chat_conversations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app_v3.chat_conversation_members
  ADD COLUMN IF NOT EXISTS organization_id integer,
  ADD COLUMN IF NOT EXISTS notif_level app_v3."ChatConversationNotificationLevel" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

UPDATE app_v3.chat_conversation_members m
SET organization_id = c.organization_id
FROM app_v3.chat_conversations c
WHERE m.conversation_id = c.id
  AND m.organization_id IS NULL;

ALTER TABLE app_v3.chat_conversation_members
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE app_v3.chat_conversation_messages
  ADD COLUMN IF NOT EXISTS organization_id integer,
  ADD COLUMN IF NOT EXISTS kind app_v3."ChatConversationMessageKind" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE app_v3.chat_conversation_messages m
SET organization_id = c.organization_id
FROM app_v3.chat_conversations c
WHERE m.conversation_id = c.id
  AND m.organization_id IS NULL;

ALTER TABLE app_v3.chat_conversation_messages
  ALTER COLUMN organization_id SET NOT NULL;

DROP INDEX IF EXISTS app_v3.chat_conversation_messages_sender_client_unique;
CREATE UNIQUE INDEX chat_conversation_messages_sender_client_unique
  ON app_v3.chat_conversation_messages (conversation_id, sender_id, client_message_id);

ALTER TABLE app_v3.chat_conversation_attachments
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;

CREATE TABLE IF NOT EXISTS app_v3.chat_message_reactions (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT chat_message_reactions_message_fkey FOREIGN KEY (message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE CASCADE,
  CONSTRAINT chat_message_reactions_user_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx
  ON app_v3.chat_message_reactions (message_id);

CREATE TABLE IF NOT EXISTS app_v3.chat_message_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  pinned_by uuid NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_pins_message_fkey FOREIGN KEY (message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE CASCADE,
  CONSTRAINT chat_message_pins_user_fkey FOREIGN KEY (pinned_by) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_message_pins_message_unique
  ON app_v3.chat_message_pins (message_id);

CREATE INDEX IF NOT EXISTS chat_message_pins_message_idx
  ON app_v3.chat_message_pins (message_id);

CREATE INDEX IF NOT EXISTS chat_conversation_messages_search_idx
  ON app_v3.chat_conversation_messages
  USING GIN (to_tsvector('simple', coalesce(body, '')));
