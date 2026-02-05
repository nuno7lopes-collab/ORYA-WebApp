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

## Status (handshake)

DONE — orgId é passado por prop e usado diretamente, sem fallback a `/api/organizacao/me`.

Evidência:
- `app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx` → `loadOrganizationId` usa `organizationId`/`fallbackOrganizationId`.
- `app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts` → mesma lógica.

## Smoke test (chat)

- Abrir Chat V2.
- Enviar 1 mensagem (sem regressao).
