-- Add context_id to chat_conversation_requests
ALTER TABLE app_v3.chat_conversation_requests
  ADD COLUMN IF NOT EXISTS context_id text;

CREATE INDEX IF NOT EXISTS chat_conversation_requests_context_idx
  ON app_v3.chat_conversation_requests (context_type, context_id);

-- Partial unique indexes to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversation_requests_user_pending_unique
  ON app_v3.chat_conversation_requests (requester_id, target_user_id, context_type, context_id)
  WHERE status = 'PENDING' AND target_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversation_requests_org_pending_unique
  ON app_v3.chat_conversation_requests (requester_id, target_organization_id, context_type, context_id)
  WHERE status = 'PENDING' AND target_organization_id IS NOT NULL;

-- Allow event chat sends even when muted (mute is notification-only)
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
  );
