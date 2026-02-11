# Chat/Messaging Contracts (Realtime + Robustness)

Status: NORMATIVE (SSOT detail for chat/messaging)  
Last update: 2026-02-11

## 1) Scope
- This document closes operational contracts for:
  - Internal chat (`/api/chat/*`)
  - B2C messaging (`/api/me/messages/*`)
  - WS gateway (`scripts/chat-ws-server.js`)
  - Redis-backed realtime/presence
- In case of conflict:
  1. `docs/ssot_registry.md`
  2. this document
  3. `docs/blueprint.md`

## 2) Transport + Auth (WS)
- WS auth token MUST NOT be sent in query string.
- Canonical WS auth is `Sec-WebSocket-Protocol`:
  - protocol: `orya-chat.v1`
  - auth token protocol: `orya-chat.auth.<access_token>`
- Sensitive tokens in URL are forbidden in production.
- Query token auth is forbidden (no fallback/legacy mode).

## 3) Realtime Event Contract
- Canonical event types:
  - `message:new`, `message:update`, `message:delete`
  - `reaction:update`, `pin:update`, `message:read`
  - `typing:start`, `typing:stop`
  - `conversation:update`, `presence:update`
- Conversation-scoped events MUST include `conversationId`.
- Event ordering is eventual; clients MUST reconcile via polling/cursor APIs.

## 4) Write Semantics (Consistency First)
- Message persistence is the source of truth.
- Realtime publish/push notification is best-effort after commit.
- API MUST NOT return 5xx/503 for a message that is already persisted only because realtime publish failed.
- When realtime is degraded, API can return non-fatal warnings (e.g. `REALTIME_DEGRADED`).

## 5) Idempotency
- Client-side message send to B2C conversation requires `clientMessageId`.
- Server dedupe key for B2C conversation messages:
  - `(conversationId, senderId, clientMessageId)` unique constraint.
- On duplicate key conflict, server returns existing message (idempotent success path), never a second message.

## 6) Read Pointer Invariants
- `lastReadMessageId` MUST belong to the same conversation.
- Read pointer MUST be monotonic:
  - never move backwards in `(createdAt, id)` ordering.
- Invalid `messageId` for read update MUST return `400 INVALID_MESSAGE`.

## 7) Reaction/Pin Idempotency
- `DELETE reaction` MUST be idempotent (delete-missing is success).
- `pin:update` and `reaction:update` payloads are full current state snapshots for that message.

## 8) Presence + Heartbeat
- Mobile and web WS clients MUST send `ping` heartbeat periodically.
- Server answers `pong` and refreshes presence TTL on ping.
- Presence TTL and ping interval are configuration-based and must remain compatible (`ping interval < TTL`).

## 9) Conversation Uniqueness (Concurrency Safety)
- DB-level uniqueness requirements:
  - USER_DM: one conversation per canonical pair (`contextId = sorted(userA:userB)`).
  - BOOKING/SERVICE/ORG_CONTACT: unique by `(organizationId, contextType, contextId, customerId)`.
- Conversation creation paths MUST handle conflict (`P2002`) and resolve by reloading canonical existing conversation.

## 10) Attachment Safety
- Chat attachment references must remain bounded to server-issued presign metadata.
- Message write requires `attachments[].metadata.path`, `attachments[].metadata.bucket` and
  `attachments[].metadata.checksumSha256` (SHA-256 hex, 64 chars).
- Attachment checksum must come from presign/upload metadata. Server-side checksum fallback paths are forbidden.

## 11) Error Contract
- Canonical behavior under degraded realtime:
  - HTTP success for persisted message
  - optional warning flag in body
  - no transport-layer failure for post-commit pub/sub outage
- Auth/permission/business rules remain hard-fail (`401/403/400`) as applicable.
