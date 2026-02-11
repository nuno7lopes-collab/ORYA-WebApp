-- Internal chat (org-only channels)
CREATE TABLE "app_v3"."internal_chat_channels" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" integer NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "is_archived" boolean NOT NULL DEFAULT false,
    "created_by_user_id" uuid,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "internal_chat_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_v3"."internal_chat_messages" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" integer NOT NULL,
    "channel_id" uuid NOT NULL,
    "author_user_id" uuid,
    "body" text NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by_user_id" uuid,
    CONSTRAINT "internal_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "internal_chat_channels_org_name_unique" ON "app_v3"."internal_chat_channels"("organization_id", "name");
CREATE INDEX "internal_chat_channels_org_archived_idx" ON "app_v3"."internal_chat_channels"("organization_id", "is_archived");
CREATE INDEX "internal_chat_messages_org_channel_time_idx" ON "app_v3"."internal_chat_messages"("organization_id", "channel_id", "created_at");
CREATE INDEX "internal_chat_messages_channel_idx" ON "app_v3"."internal_chat_messages"("channel_id");

ALTER TABLE "app_v3"."internal_chat_channels"
    ADD CONSTRAINT "internal_chat_channels_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_v3"."internal_chat_channels"
    ADD CONSTRAINT "internal_chat_channels_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_v3"."internal_chat_messages"
    ADD CONSTRAINT "internal_chat_messages_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_v3"."internal_chat_messages"
    ADD CONSTRAINT "internal_chat_messages_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "app_v3"."internal_chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_v3"."internal_chat_messages"
    ADD CONSTRAINT "internal_chat_messages_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_v3"."internal_chat_messages"
    ADD CONSTRAINT "internal_chat_messages_deleted_by_user_id_fkey"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
