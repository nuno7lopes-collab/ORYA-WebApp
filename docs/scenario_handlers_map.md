# Fulfillment Handlers por Cenário (emissão idempotente)

Regras base: emissão só após `SaleSummary.status=PAID` (ou PAID method=FREE). Idempotência via uniques (purchaseId + ticketTypeId + emissionIndex) e transações. Rounding split: total ímpar → capitão absorve +1 cêntimo (`ceil(total/2)` / `floor(total/2)`).

| cenário | handler/Operation principal | operações encadeadas | efeitos DB/side-effects | notas idempotência |
| --- | --- | --- | --- | --- |
| SINGLE (pago) | ISSUE_TICKETS:{purchaseId} | UPSERT_LEDGER_FROM_PI → ISSUE_TICKETS → APPLY_PROMO_REDEMPTION → SEND_EMAIL_RECEIPT/NOTIFY | Cria tickets por linha; atualiza soldQuantity; promo_redemption se aplicável. | Unique por purchaseId+ticketTypeId+emissionIndex; SaleSummary único por purchaseId. |
| FREE | ISSUE_TICKETS_FREE:{purchaseId} | UPSERT_LEDGER_FROM_PI (free) → ISSUE_TICKETS → APPLY_PROMO_REDEMPTION | Tickets com price=0, fees=0; soldQuantity increment. | Mesmo esquema de uniques; PaymentEvent source=API, dedupe purchaseId. |
| RESALE | ISSUE_RESALE_TRANSFER:{purchaseId} | UPSERT_LEDGER_FROM_PI (resale PI) → TRANSFER_TICKET_OWNERSHIP → UPDATE_PAYMENT_EVENT | Muda owner do ticket revenda, marca resale SOLD. | Idempotência pelo resaleId+ticketId+purchaseId; não recria ticket. |
| GROUP_FULL (padel) | ISSUE_TICKETS_PADL_FULL:{purchaseId} | UPSERT_LEDGER_FROM_PI → ISSUE_TICKETS (2 bilhetes) → CONFIRM_PAIRING | Cria 2 tickets (capitão+parceiro), pairing INCOMPLETE, soldQuantity+2. | emissionIndex por ticketType garante no-dup; pairing update apenas se ainda incompleto. |
| GROUP_SPLIT (partner paying) | ISSUE_TICKETS_PADL_SPLIT_PARTNER:{purchaseId} | UPSERT_LEDGER_FROM_PI → ISSUE_TICKETS (1 share) → CONFIRM_PAIRING (quando slots pagos) | Cria ticket do parceiro, marca slot PAID; se ambos pagos → pairing COMPLETE + entries. | dedupe purchaseId; slot paymentStatus check evita duplicação. |
| GROUP_SPLIT_SECOND_CHARGE (off-session capitão) | CONFIRM_SECOND_CHARGE:{pairingId:pi} | PROCESS_STRIPE_EVENT → UPSERT_LEDGER_FROM_PI? (se aplicável) → CONFIRM_SECOND_CHARGE | Atualiza pairing lifecycle para CONFIRMED_CAPTAIN_FULL, limpa holds/grace. | dedupe pairingId:pi impede múltiplos updates. |
| SUBSCRIPTION (stub futuro) | ISSUE_SUBSCRIPTION_ENTITLEMENT:{purchaseId} | UPSERT_LEDGER_FROM_PI → ISSUE_ENTITLEMENT (periodic) | Regista entitlement inicial; próximas renovações via job. | dedupe purchaseId; renovações têm dedupe por periodKey. |

Constraints recomendados:
- Tickets: unique (purchaseId, ticketTypeId, emissionIndex); indexes em stripePaymentIntentId e saleSummaryId.
- Promo redemptions: unique (promoCodeId, purchaseId).
- SaleSummary: unique (purchaseId); idealmente unique (paymentIntentId).
- Pairing: evita dupla confirmação verificando status/slots em transação.

Observabilidade:
- Logs estruturados com purchaseId, paymentIntentId, scenario, dedupeKey, attemptNo.
- Métricas: sale_paid_total, fulfillment_failed_total, operations_backlog_total. 
