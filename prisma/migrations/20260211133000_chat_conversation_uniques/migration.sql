-- Chat conversation uniqueness hardening for concurrency

-- 1) Backfill USER_DM context_id as canonical user pair (sorted UUIDs).
WITH dm_pairs AS (
  SELECT
    cm.conversation_id,
    string_agg(cm.user_id::text, ':' ORDER BY cm.user_id::text) AS pair_key,
    COUNT(*) AS member_count
  FROM app_v3.chat_conversation_members cm
  JOIN app_v3.chat_conversations c
    ON c.id = cm.conversation_id
  WHERE c.context_type = 'USER_DM'
  GROUP BY cm.conversation_id
)
UPDATE app_v3.chat_conversations c
SET context_id = dm_pairs.pair_key
FROM dm_pairs
WHERE c.id = dm_pairs.conversation_id
  AND dm_pairs.member_count = 2
  AND (c.context_id IS NULL OR c.context_id = '' OR c.context_id <> dm_pairs.pair_key);

-- 2) USER_DM uniqueness (one conversation per canonical user pair).
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_user_dm_pair_unique
  ON app_v3.chat_conversations (context_type, context_id)
  WHERE context_type = 'USER_DM' AND context_id IS NOT NULL;

-- 3) Customer-scoped B2C channel uniqueness by context (booking/service/org-contact).
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_org_context_customer_unique
  ON app_v3.chat_conversations (organization_id, context_type, context_id, customer_id)
  WHERE context_type IN ('BOOKING', 'SERVICE', 'ORG_CONTACT')
    AND organization_id IS NOT NULL
    AND customer_id IS NOT NULL;
