# Entitlement Revocation/Suspension Matrix (Bloco 3)

Estados de bloqueio escritos apenas pelo worker (Bloco 2) a partir de ledger/refunds/disputes/transfer.

| Trigger | Efeito no entitlement | Resulto de scan | Notas |
| --- | --- | --- | --- |
| Refund (cancelado/apagado/alteração data) | status → REFUNDED e REVOKED (bloqueia acesso) | REFUNDED | Refund é base-only (fees não devolvidos). |
| Dispute/chargeback/risco | status → SUSPENDED | SUSPENDED | Audit de risco; pode ser revertido manualmente. |
| Resale/transfer (futuro) | antigo → REVOKED; novo → ACTIVE | REVOKED para antigo | Histórico mantido; purchaseId/source preservados por linha. |
| Chargeback revertido / desbloqueio | status → ACTIVE (se válido) | OK | Apenas via Operation autorizada. |

Hard rules
- REFUNDED/REVOKED/SUSPENDED bloqueiam canShowQr e canCheckIn.
- Worker grava mudança + timeline + logs com purchaseId/entitlementId/reasonCode.
- Bloco 3 nunca altera status; apenas lê para actions.
