# Bloco 2 — Métricas e Alertas

Logs estruturados (obrigatórios em Operations/handlers)
- purchaseId, paymentIntentId, scenario, ownerKey, eventId/pairingId, dedupeKey, operationType, attemptNo.

Métricas (counter/gauge)
- intent_created_total
- sale_paid_total
- fulfillment_failed_total
- stuck_processing_total
- refund_failed_total
- dispute_open_total
- operations_backlog_total (por status)
- dead_letter_total
- payout_scheduled_total
- payout_transfers_succeeded_total
- payout_transfers_failed_total
- reserve_held_total
- reserve_released_total
- payouts_blocked_total

Alertas mínimos
- stuck_processing_total sobe acima de limiar (ex.: >N ou crescimento rápido).
- refund_failed_total sobe (falha em PROCESS_REFUND_SINGLE).
- operations_backlog_total cresce de forma sustentada.
- dead_letter_total > 0 (ou variação diária).
- payout_transfers_failed_total > 0 ou spike.
- dispute_open_total sobe → bloquear payouts associados.

Dashboards sugeridos
- Funil checkout → ledger → emissão → notificações.
- Backlog Operations por status/idade.
- Payouts: agendados vs executados, reservas retidas/liberadas.
- Refunds: batches em curso, singles falhados. 
