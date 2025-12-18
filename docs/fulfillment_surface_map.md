# Fulfillment Surface Map

Legenda: responsabilidade ∈ {INGEST, PROCESS, LEDGER, FULFILLMENT, REFUND, DISPUTE, NOTIFY, RECONCILE}. Classificação: CORE = desejado no alvo, SUSPEITO = precisa convergir, LEGACY = fluxo a ser removido/refatorado.

| path/rota/worker | responsabilidade | cenários (SINGLE/FREE/RESALE/GROUP_SPLIT/GROUP_FULL/…) | classificação |
| --- | --- | --- | --- |
| app/api/stripe/webhook/route.ts | INGEST, PROCESS, LEDGER, FULFILLMENT, REFUND, NOTIFY | payment_intent.succeeded para SINGLE/RESALE/GROUP_FULL/GROUP_SPLIT (incl. second charge), charge.refunded, emite tickets/entries, promo_redemptions, emails e notificações de pairing/tournament | LEGACY |
| app/api/payments/intent/route.ts | PROCESS, LEDGER, FULFILLMENT, NOTIFY | FREE checkout (cria sale_summary/lines, tickets, PaymentEvent, notificação organizer) e prepara intents para SINGLE/GROUP_FULL/GROUP_SPLIT | SUSPEITO |
| app/api/cron/padel/expire/route.ts | PROCESS, REFUND, FULFILLMENT | GROUP_SPLIT guarantee: expira holds, cobra off-session capitão, faz refund/cancelamento de tickets/slots | SUSPEITO |
| (removido) app/api/internal/refunds/event/route.ts | DELETE | Legacy batch refund fora do worker | DELETE |
| (removido) app/api/internal/refunds/date-changed/route.ts | DELETE | Legacy batch refund fora do worker | DELETE |
| lib/refunds/refundService.ts | PROCESS, REFUND, LEDGER | refundPurchase (Stripe refund base-only por purchaseId/paymentIntentId, grava refund auditável) | CORE |
| app/api/admin/eventos/update-status/route.ts | PROCESS, REFUND | Admin altera status (CANCELLED/DELETED/DATE_CHANGED) → enfileira PROCESS_REFUND_SINGLE via Operation | CORE |
| app/api/admin/payments/dispute/route.ts | PROCESS, DISPUTE, LEDGER | Marca saleSummary DISPUTED + PaymentEvent DISPUTED manual (sem RBAC forte) | LEGACY |
| domain/finance/disputes.ts | PROCESS, DISPUTE, LEDGER | markSaleDisputed transactiona: atualiza sale_summary e regista PaymentEvent | SUSPEITO |
| app/api/organizador/payouts/webhook/route.ts | INGEST, PROCESS | Stripe Connect account.updated → sincroniza flags charges_enabled/payouts_enabled | SUSPEITO |
| scripts/backfillSaleSummaries.js | RECONCILE, LEDGER | Backfill sale_summary/sale_line a partir de tickets+payment_events para intents existentes | LEGACY |
| scripts/backfillStripeFees.js | RECONCILE, LEDGER | Backfill stripe_fee_cents/net em sale_summaries e payment_events via Stripe balance_transaction | LEGACY |

Notas rápidas:
- Não existe worker/outbox dedicado: webhook executa efeitos completos (ledger + emissão + promo + notificações) e precisa ser separado para cumprir ingest-only.
- Refunds/disputes históricos alteravam ledger/tickets de forma inconsistente. Foram removidos fluxos legacy; apenas o worker executa PROCESS_REFUND_SINGLE/PROCESS_REFUND_BATCH via Operation.
