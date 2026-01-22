CREATE TYPE app_v3."ChatConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE app_v3."ChatConversationMemberRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE app_v3."ChatAttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');

ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
ALTER TYPE app_v3."TournamentMatchStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

CREATE TABLE app_v3.chat_conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id integer NOT NULL,
    type app_v3."ChatConversationType" NOT NULL,
    title text,
    created_by_user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_message_at timestamp with time zone,
    last_message_id uuid,
    CONSTRAINT chat_conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE app_v3.chat_conversation_members (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role app_v3."ChatConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    muted_until timestamp with time zone,
    last_read_message_id uuid,
    CONSTRAINT chat_conversation_members_pkey PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE app_v3.chat_conversation_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text,
    client_message_id text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    reply_to_id uuid,
    CONSTRAINT chat_conversation_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE app_v3.chat_conversation_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL,
    type app_v3."ChatAttachmentType" NOT NULL,
    url text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversation_attachments_pkey PRIMARY KEY (id)
);

CREATE TABLE app_v3.chat_user_presence (
    user_id uuid NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chat_user_presence_pkey PRIMARY KEY (user_id)
);

CREATE TABLE app_v3.chat_message_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chat_message_reports_pkey PRIMARY KEY (id)
);

CREATE TABLE app_v3.chat_user_blocks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chat_user_blocks_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX chat_conversations_last_message_id_key ON app_v3.chat_conversations(last_message_id);
CREATE INDEX chat_conversations_org_idx ON app_v3.chat_conversations(organization_id);
CREATE INDEX chat_conversations_last_message_idx ON app_v3.chat_conversations(last_message_at);
CREATE INDEX chat_conversation_members_user_idx ON app_v3.chat_conversation_members(user_id);
CREATE INDEX chat_conversation_members_conversation_idx ON app_v3.chat_conversation_members(conversation_id);
CREATE INDEX chat_conversation_messages_conversation_created_idx ON app_v3.chat_conversation_messages(conversation_id, created_at DESC);
CREATE INDEX chat_conversation_messages_conversation_idx ON app_v3.chat_conversation_messages(conversation_id);
CREATE INDEX chat_conversation_messages_sender_idx ON app_v3.chat_conversation_messages(sender_id);
CREATE UNIQUE INDEX chat_conversation_messages_sender_client_unique ON app_v3.chat_conversation_messages(sender_id, client_message_id);
CREATE INDEX chat_conversation_attachments_message_idx ON app_v3.chat_conversation_attachments(message_id);
CREATE INDEX chat_message_reports_message_idx ON app_v3.chat_message_reports(message_id);
CREATE INDEX chat_message_reports_reporter_idx ON app_v3.chat_message_reports(reporter_id);
CREATE INDEX chat_user_blocks_blocked_idx ON app_v3.chat_user_blocks(blocked_id);
CREATE UNIQUE INDEX chat_user_blocks_unique ON app_v3.chat_user_blocks(blocker_id, blocked_id);

ALTER TABLE app_v3.chat_conversations
    ADD CONSTRAINT chat_conversations_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversations
    ADD CONSTRAINT chat_conversations_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversations
    ADD CONSTRAINT chat_conversations_last_message_id_fkey
    FOREIGN KEY (last_message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_members
    ADD CONSTRAINT chat_conversation_members_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES app_v3.chat_conversations(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_members
    ADD CONSTRAINT chat_conversation_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_members
    ADD CONSTRAINT chat_conversation_members_last_read_message_id_fkey
    FOREIGN KEY (last_read_message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_messages
    ADD CONSTRAINT chat_conversation_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES app_v3.chat_conversations(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_messages
    ADD CONSTRAINT chat_conversation_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_messages
    ADD CONSTRAINT chat_conversation_messages_reply_to_id_fkey
    FOREIGN KEY (reply_to_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_conversation_attachments
    ADD CONSTRAINT chat_conversation_attachments_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_user_presence
    ADD CONSTRAINT chat_user_presence_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_message_reports
    ADD CONSTRAINT chat_message_reports_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES app_v3.chat_conversation_messages(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_message_reports
    ADD CONSTRAINT chat_message_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_user_blocks
    ADD CONSTRAINT chat_user_blocks_blocker_id_fkey
    FOREIGN KEY (blocker_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE app_v3.chat_user_blocks
    ADD CONSTRAINT chat_user_blocks_blocked_id_fkey
    FOREIGN KEY (blocked_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;
