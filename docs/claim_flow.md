# Claim Guest Flow (Bloco 3)

Objetivo: reassociar entitlements de guest (ownerIdentityId) para user (ownerUserId) após emailVerifiedAt. Enqueue-only + Operation idempotente.

## Endpoint
- POST /api/me/claim-guest (nome sugerido)
- Input: { purchaseId }
- Auth: user autenticado com emailVerifiedAt obrigatório.
- Comportamento: enfileira Operation e responde 202/ok; não executa efeitos no request.

## Operation
- type: `CLAIM_GUEST_PURCHASE`
- dedupeKey: `CLAIM_GUEST_PURCHASE:${purchaseId}:${userId}`
- preconditions: emailVerifiedAt != null; purchase pertence ao email; status não REFUNDED/REVOKED/SUSPENDED.
- efeito: atualizar entitlements -> ownerUserId (preservar ownerIdentityId histórico se precisarmos em audit), manter purchaseId/saleLineId/source; logar timeline.
- idempotente: reruns não criam novas linhas (unique do entitlement impede duplicação).

## Respostas esperadas
- 401 se não autenticado.
- 403 `FORBIDDEN_CLAIM` se email não verificado ou estados bloqueados.
- 202 sempre que enfileira (mesmo em retry idempotente).

## Observabilidade
- Log com purchaseId, userId, dedupeKey, resultCode (ENQUEUED/NOOP_ALREADY_CLAIMED).
