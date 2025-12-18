# Bloco 2 — Catálogo de Operations (worker)

Regra: todas as ações com efeitos passam pelo worker via Operations idempotentes. Cada Operation tem `operationType`, `dedupeKey`, `status` (PENDING | RUNNING | SUCCEEDED | FAILED | DEAD_LETTER), `attempts`, `lastError`, `lockedAt`, `nextRetryAt`, e correlações (`purchaseId`, `paymentIntentId`, `stripeEventId`, `eventId`, `organizerId`, `pairingId`, etc.).

## Tabela principal
| operationType | dedupeKey (determinístico) | pré-condições (ledger/estado) | efeitos esperados (writes/side-effects) |
| --- | --- | --- | --- |
| PROCESS_STRIPE_EVENT | `stripeEventId` (ou `paymentIntentId` se faltar) | PaymentEvent persisted (INGEST). | Decidir próxima operação (ex: UPSERT_LEDGER_FROM_PI) e atualizar PaymentEvent status/erro; nunca emitir efeitos diretos. |
| UPSERT_LEDGER_FROM_PI | `paymentIntentId` ou `purchaseId` (FREE usa purchaseId) | PaymentIntent válido; PaymentEvent OK/PROCESSING; não há SaleSummary final. | Upsert SaleSummary/SaleLines com breakdown; set state PROCESSING/PAID; calcula fees/net; corrige promo snapshots. |
| ISSUE_TICKETS | `purchaseId` (ou `saleSummaryId`) | SaleSummary status=PAID, scenario != split partner off-session pendente; stock suficiente. | Criar/complentar Tickets idempotente (unique por purchaseId+ticketTypeId+emissionIndex), atualizar soldQuantity, link guest. |
| ISSUE_TOURNAMENT_ENTRIES | `purchaseId` (ou `eventId:ownerId`) | SaleSummary PAID; evento torneio elegível; tickets emitidos. | Criar TournamentEntry/entry slots idempotente, associar purchaseId/saleSummaryId. |
| APPLY_PROMO_REDEMPTION | `promoCodeId:purchaseId` | SaleSummary PAID; promo elegível; limites não excedidos. | Upsert promo_redemptions com userId/guestEmail; guarda cancelledAt se refund posterior. |
| PROCESS_REFUND_BATCH | `eventId:reason:batchKey` | Evento cancelado/deleted/date_changed; políticas validadas. | Lista purchases PAID, cria/enfila PROCESS_REFUND_SINGLE por purchaseId; audita batch. |
| PROCESS_REFUND_SINGLE | `eventId:purchaseId` | SaleSummary status=PAID ou DISPUTED; policy base-only; sem refund registrado com mesmo dedupe. | Criar Refund record, chamar Stripe refund (quando pago), marcar SaleSummary REFUNDED, Tickets status=REFUNDED, cancelar promo_redemptions. |
| MARK_DISPUTE | `paymentIntentId` (ou `purchaseId`) | Dispute signal recebido (Stripe/Admin); SaleSummary existente ou PaymentEvent. | SaleSummary status→DISPUTED; PaymentEvent DISPUTED; bloquear payouts relacionados; timeline/audit. |
| CONFIRM_PAIRING | `pairingId` | Padel pairing completo (SPLIT ou FULL), SaleSummary/Tickets emitidos. | Atualizar pairing status COMPLETE, garantir TournamentEntries; enviar notificações. |
| CONFIRM_SECOND_CHARGE | `pairingId:secondChargePaymentIntentId` | Padel SPLIT guarantee off-session succeed; PaymentEvent recebido. | Atualizar pairing lifecycle -> CONFIRMED_CAPTAIN_FULL, PaymentEvent OK, limpa holds/grace. |
| CANCEL_PAIRING_AND_REFUND | `pairingId:cancelKey` | Pairing SPLIT expirado/failed; tickets ligados. | Cancelar slots, marcar tickets REFUNDED, atualizar pairing lifecycle CANCELLED_INCOMPLETE, enfileirar refund Stripe se aplicável. |
| SEND_EMAIL_RECEIPT | `purchaseId:email` | SaleSummary PAID e tickets emitidos; email conhecido. | Enviar recibo/confirm email; registrar outbox/log idempotente. |
| SEND_NOTIFICATION_PURCHASE | `purchaseId:userId` | SaleSummary PAID; userId presente. | Enfileirar notification outbox (EVENT_SALE, etc.) dedupe por purchaseId:user. |
| APPLY_PROMO_REDEMPTION | `APPLY_PROMO_REDEMPTION:{purchaseId}` | SaleSummary PAID com promoCodeId ou payload com promoCodeId; limites válidos. | Upsert promo_redemptions idempotente respeitando limites; sem duplicar. |
| PROCESS_CONNECT_EVENT | `connectEventId` | Stripe account.updated ou similares; PaymentEvent stored. | Sync organizer Stripe flags; enfileirar SCHEDULE_PAYOUT_RELEASE se necessário. |
| SCHEDULE_PAYOUT_RELEASE | `organizerId:eventId:periodKey` | Policy disponível; sales existentes. | Gerar agenda de transferências futuras (ledger reserva) sem mover dinheiro ainda. |
| CREATE_TRANSFER_TO_ORGANIZER | `organizerId:eventId:periodKey` | releaseAt atingido; sem bloqueio de dispute/refund; reservePercent aplicado. | Criar Stripe Transfer (modelo A), registrar em ledger interno; atualizar reserve bucket. |
| RELEASE_RESERVE | `organizerId:reserveBucketId` | reserveDays cumpridos; nenhum bloqueio ativo. | Libertar reserve para organizer (Transfer ou ajuste interno), auditar. |
| BLOCK_PAYOUTS_ON_RISK | `organizerId:policyVersion` | Sinal de risco/dispute; payouts futuros não liberados. | Marcar bloqueio, impedir SCHEDULE/TRANSFER até解除. |
| RECONCILE_STUCK_OPERATION | `operationId:retryNo` | Operation stuck/excedeu SLA. | Reenfileira operação original ou marca DEAD_LETTER com razão auditável. |
| REBUILD_LEDGER_FROM_EVENTS | `paymentIntentId` | PaymentEvent existe, SaleSummary inconsistente/ausente. | Reconstruir SaleSummary/SaleLines conservadoramente a partir de PaymentEvent/charges. |

## Notas de dedupe e correlação
- dedupeKey nunca deve depender de timestamps/random; use purchaseId, paymentIntentId, stripeEventId, eventId, organizerId, pairingId.
- Toda Operation carrega correlations para logs/metrics: purchaseId, paymentIntentId, scenario, ownerKey (userId/identity/email), eventId/pairingId, dedupeKey, attemptNo.
- Reentrância: reexecutar qualquer Operation com o mesmo dedupeKey resulta no mesmo estado final (sem duplicar tickets/refunds/promo/transfers).

## Pré-condições por grupo
- Ledger: UPSERT_LEDGER_FROM_PI requer PaymentEvent válido e ausência de SaleSummary finalizado; não reabre REFUNDED/DISPUTED sem reconciliação explícita.
- Fulfillment: ISSUE_TICKETS/ENTRIES/APPLY_PROMO só correm se SaleSummary.status=PAID e stock/eligibilidade ok.
- Refunds: PROCESS_REFUND_SINGLE só corre se SaleSummary status em {PAID, DISPUTED}; se já REFUNDED com mesmo dedupeKey → no-op.
- Payouts: CREATE_TRANSFER/RELEASE_RESERVE bloqueados se existirem disputes/refunds pendentes ou policy blocker ativo.

## Status e erros
- FAILED: erro retryable; será reprocessado conforme backoff/nextRetryAt.
- DEAD_LETTER: erro não-retryable ou excesso de tentativas; precisa de intervenção manual (admin tool passo 10/11).
- Todas as mutações de estado devem ser atómicas por Operation (transação DB); se falhar a meio, rerun atinge o mesmo final.

## Integração com ingest-only
- Webhook/API apenas criam PaymentEvent + Operation iniciais: PROCESS_STRIPE_EVENT ou UPSERT_LEDGER_FROM_PI (FREE), nunca efeitos.
- Crons/admin tools (refund/dispute/padel) enfileiram as Operations acima; o worker é a única superfície de efeitos. 
