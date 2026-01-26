# Handshake: Chat V2 orgId

## Contexto (read-only)

1) `app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx`
- Funcao: `loadOrganizationId`
- Origem orgId proposta: UI context (query `organizationId` via `useSearchParams`) ou prop do parent.

2) `app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts`
- Funcao: `loadOrganizationId`
- Origem orgId proposta: prop vindo do `ChatPreviewClient` (que recebe do page/layout) ou query param.

3) `app/organizacao/(dashboard)/chat/page.tsx`
- Funcao: `OrganizationChatPage`
- Origem orgId: `getActiveOrganizationForUser` (server); passar `organization.id` para o client.

## TODO (handshake)

- Match: `app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx:610`
- Match: `app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts:484`
- Remover fallback `/api/organizacao/me` quando orgId prop existe.

## Plano do commit (1 commit, sem refactor)

Commit: `chat: pass orgId`

- `ChatInternoClient/ChatInternoV2Client`: aceitar `organizationId` prop; inicializar state com esse valor; evitar fetch a `/api/organizacao/me` quando a prop existe.
- `ChatPreviewClient/useChatPreviewData`: aceitar `organizationId` prop; usar diretamente em `loadOrganizationId`.
- `chat/page.tsx`: passar `organization.id` para `ChatPreviewClient` (e/ou `ChatInternoClient`).
- Sem tocar em RBAC/policy.

## Smoke test (chat)

- Abrir Chat V2.
- Enviar 1 mensagem (sem regressao).
