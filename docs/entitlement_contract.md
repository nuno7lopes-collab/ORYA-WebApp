# Entitlement Contract (Bloco 3)

SSOT de acesso emitido/atualizado apenas pelo worker (Bloco 2). Bloco 3 só lê.

## Campos obrigatórios
- entitlementId: chave estável (surge do materialized view/entitlements).
- type: EVENT_TICKET | PADEL_ENTRY | PASS | SUBSCRIPTION_ACCESS | FUTURE_TYPE.
- scope: eventId e/ou tournamentId e/ou seasonId (pelo menos um conforme o type).
- ownerUserId XOR ownerIdentityId (email normalizado); nunca ambos.
- purchaseId (TEXT pur_<hex>) + saleLineId: source/reconciler.
- status: ACTIVE | USED | REFUNDED | REVOKED | SUSPENDED.
- displaySnapshot: ver snapshot policy (title, coverUrl, venueName, startAt, timezone).
- actions: computed pelo Access Policy Resolver (não persistir guesses no FE).
- audit fields: createdAt, updatedAt, snapshotVersion (para sincronização FE/Email).

## Regras
- Âncora universal: purchaseId é obrigatório para dedupe/log/email/timeline.
- Idempotência: reruns do worker não podem criar duplicados (ver storage).
- Ownership: transições (ex.: claim) preservam purchaseId/source e histórico; apenas ownerKey muda.
- Status: USED = check-in efetuado; REFUNDED/REVOKED/SUSPENDED bloqueiam acesso/QR.
- UI/Email só usam snapshot e actions, nunca assumem estado do evento ao vivo.

## Relação com operações
- Emissão/revogação/refund/suspensão: Operation no worker atualiza entitlements.
- Claim guest: Operation reassocia ownerKey mantendo source.
- Emails/outbox: usam entitlementId/purchaseId e dedupeKey únicos.
