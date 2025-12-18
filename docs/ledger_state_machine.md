# Ledger State Machine (SaleSummary SSOT)

Estados internos: `PENDING | PROCESSING | REQUIRES_ACTION | PAID | FAILED | REFUNDED | DISPUTED`.

## Transições permitidas
- PENDING → PROCESSING (intent criado; PaymentEvent recebido)
- PROCESSING → REQUIRES_ACTION (Stripe requires_action)  
- REQUIRES_ACTION → PROCESSING (utilizador retoma/resolve ação)
- PROCESSING → PAID (worker fecha SaleSummary e SaleLines com breakdown final)
- PROCESSING → FAILED (erro definitivo: canceled/requires_payment_method/stock inválido)
- REQUIRES_ACTION → FAILED (utilizador não conclui ou PI cancelado)
- PAID → REFUNDED (refund base-only concluído, dedupe por purchaseId)
- PAID → DISPUTED (dispute recebida)
- DISPUTED → REFUNDED (se policy exigir reembolso)
- DISPUTED → PAID (se disputa resolvida a favor; opcional, requer audit)

Transições proibidas (invariantes):
- Nunca voltar de REFUNDED para estados de compra ativa.
- Nunca apagar SaleSummary; correções são novas Operations idempotentes.
- Não reabrir PAID para PROCESSING sem reconciliação explícita.
- DISPUTED congela operações perigosas (payout/release) até resolução.

## Invariantes
- 1 SaleSummary por `purchaseId` (ou `paymentIntentId` quando não há purchaseId).
- SaleLines detalham o breakdown final e batem com SaleSummary (subtotal/discount/fees/total/net).
- `paymentIntentId` idealmente unique em SaleSummary.
- Finalidade: PAID significa ledger fechado; emissão só após PAID.
- REFUNDED/ DISPUTED preservam histórico; não reescrever linhas, apenas marcar estados/timestamps.

## Mapeamento Stripe → estado interno (conservador)
- `requires_action` → REQUIRES_ACTION
- `processing` → PROCESSING
- `succeeded` → só vira PAID quando worker fecha SaleSummary
- `canceled` / `requires_payment_method` → FAILED

## Entradas e saídas
- Entradas: Operations `UPSERT_LEDGER_FROM_PI`, `PROCESS_REFUND_SINGLE`, `MARK_DISPUTE`, reconciliação.
- Saídas (permitidas em PAID): `ISSUE_TICKETS`, `ISSUE_TOURNAMENT_ENTRIES`, `APPLY_PROMO_REDEMPTION`, notificações/recebos.  
  Em estados não finais, apenas logging/PaymentEvent updates; sem efeitos de fulfillment.

## Motivos de término
- PAID: compra finalizada; fulfillment liberado.
- FAILED: não há emissão; pode haver nova intent (novo purchaseId).
- REFUNDED: emissão original finalizada; reemissão só via nova compra.
- DISPUTED: bloqueios aplicados; resolução decide REFUNDED ou volta a PAID (com audit). 
