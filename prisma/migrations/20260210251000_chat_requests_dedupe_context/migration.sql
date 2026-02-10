-- Backfill context_id for PENDING requests that use implicit context
UPDATE app_v3.chat_conversation_requests
SET context_id = 'USER_DM', updated_at = now()
WHERE context_type = 'USER_DM' AND context_id IS NULL;

UPDATE app_v3.chat_conversation_requests
SET context_id = 'ORG_CONTACT', updated_at = now()
WHERE context_type = 'ORG_CONTACT' AND context_id IS NULL;

-- De-duplicate pending USER_DM requests per requester/target
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY requester_id, target_user_id, context_type, context_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM app_v3.chat_conversation_requests
  WHERE status = 'PENDING'
    AND context_type = 'USER_DM'
    AND target_user_id IS NOT NULL
)
UPDATE app_v3.chat_conversation_requests
SET status = 'CANCELLED', resolved_at = now(), updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- De-duplicate pending ORG_CONTACT requests per requester/org
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY requester_id, target_organization_id, context_type, context_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM app_v3.chat_conversation_requests
  WHERE status = 'PENDING'
    AND context_type = 'ORG_CONTACT'
    AND target_organization_id IS NOT NULL
)
UPDATE app_v3.chat_conversation_requests
SET status = 'CANCELLED', resolved_at = now(), updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
