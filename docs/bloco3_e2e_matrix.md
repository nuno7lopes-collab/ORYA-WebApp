# Bloco 3 E2E Matrix (verde por definição)

| # | Setup | Ação | Esperado |
| --- | --- | --- | --- |
| 1 | Compra paga (purchaseId pur_*) gera entitlements ACTIVE | Chamar `/api/me/wallet` | Entitlements aparecem com snapshot+actions; paginação estável. ✅ |
| 2 | Guest compra; email verificado | POST `/api/me/claim-guest` (enqueue) | Operation enfileirada; entitlements reatribuídos a ownerUserId; wallet privada mostra itens; timeline regista CLAIM_COMPLETED. ✅ |
| 3 | Entitlement ACTIVE com QR | Scan via `/api/organizador/checkin` | Primeiro scan → OK/USED; segundo scan → ALREADY_USED; audit gravada. |
| 4 | Refund batch aplicado | Scan QR novamente | Resultado REFUNDED/REVOKED; acesso bloqueado. |
| 5 | Dispute leva a SUSPENDED | Scan QR | Resultado SUSPENDED; timeline mostra suspensão. |
| 6 | Permissões | Acesso wallet público | 403 FORBIDDEN_WALLET_ACCESS; organizer só vê attendees do próprio evento. |
| 7 | Emails/outbox | Trigger send (purchase/refund/claim) | Outbox dedupeKey única; Operation SEND_EMAIL; sem duplicados; status SENT. |
| 8 | Paginação | Listar wallet com cursor | snapshotStartAt DESC; nextCursor funcional; idempotente. |
