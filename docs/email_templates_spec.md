# Email Templates Spec (Bloco 3)

Cada template tem payload mínimo, sempre com purchaseId e, quando aplicável, entitlementId(s) para tracking.

- PURCHASE_CONFIRMED: { purchaseId, totalCents, currency, items[{title, quantity, startAt, venueName}] }
- PURCHASE_CONFIRMED_GUEST: { purchaseId, guestEmail, verifyCtaUrl }
- ENTITLEMENT_DELIVERED: { purchaseId, entitlements[{entitlementId, snapshotTitle, snapshotStartAt, snapshotVenueName, type, status}] }
- ENTITLEMENT_DELIVERED_GUEST: { purchaseId, entitlements[...], verifyCtaUrl }
- CLAIM_GUEST: { purchaseId, claimedByUserId, claimedAt }
- REFUND: { purchaseId, amountRefundedBaseCents, reasonCode (CANCELLED/DELETED/DATE_CHANGED/DISPUTE), entitlements[{id,type,status}] }
- IMPORTANT_UPDATE: { purchaseId, entitlementId?, message, updatedFields[{field, old, new}] }

Regras
- Nenhum template enviado diretamente de rotas UI; sempre via Outbox + Operation.
- Campos opcionais devem ter defaults claros (ex.: venueName opcional).
- Cópias guest vs user têm wording diferente mas compartilham payload base.
