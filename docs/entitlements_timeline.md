# Entitlements Timeline (Bloco 3)

Objetivo: linha temporal única para suporte/admin: purchase → ledger → entitlements → check-ins → refunds/disputes → emails.

## Eventos chave (com campos obrigatórios)
- PAYMENT_RECORDED: purchaseId, paymentEventId, amount, status.
- ENTITLEMENTS_UPSERTED: purchaseId, entitlementIds[], status per item, snapshotVersion.
- CLAIM_COMPLETED: purchaseId, userId, previousOwnerIdentityId.
- CHECKIN_ATTEMPT: purchaseId, entitlementId, eventId, resultCode, deviceId, checkedInBy, checkedInAt.
- REFUND_APPLIED / REVOCATION / SUSPENSION: purchaseId, entitlementIds[], reasonCode.
- EMAIL_SENT: purchaseId, entitlementId?, templateKey, recipient, dedupeKey, status.

## Regras
- Ordenar por createdAt; incluir dedupeKey/operationId quando existir.
- Todos os eventos logam purchaseId (TEXT) e, se aplicável, entitlementId e scopeId.
- UI admin mostra timeline com códigos estáveis (sem leak de dados pessoais além do necessário).
