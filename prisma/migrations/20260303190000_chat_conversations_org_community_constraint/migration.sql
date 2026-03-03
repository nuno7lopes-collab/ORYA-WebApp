-- Include ORG_COMMUNITY as an organization-scoped conversation context.
ALTER TABLE app_v3.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_context_org_chk;

ALTER TABLE app_v3.chat_conversations
  ADD CONSTRAINT chat_conversations_context_org_chk
  CHECK (
    (context_type IN ('ORG_CHANNEL', 'ORG_COMMUNITY', 'ORG_CONTACT', 'EVENT', 'BOOKING', 'SERVICE') AND organization_id IS NOT NULL)
    OR (context_type IN ('USER_DM', 'USER_GROUP') AND organization_id IS NULL)
  );
