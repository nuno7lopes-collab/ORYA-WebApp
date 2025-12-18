# Checkout Timeline (observabilidade)

Campos mínimos a logar em cada evento/handler:
- `purchaseId`, `paymentIntentId`, `paymentScenario`, `ownerKey` (userId ou emailNormalized), `eventId`, `pairingId?`, `resaleId?`.
- `status`, `code`, `nextAction`, `retryable`.
- `amountCents`, `currency`, `platformFeeCents`, `promoCodeId?`.

Passo a passo esperado:
1) `/api/payments/intent` → PaymentEvent (`PROCESSING`), metadata com items, scenario, owner.
2) Stripe → `payment_intent.succeeded` → webhook cria/atualiza PaymentEvent (`OK`), cria SaleSummary/SaleLines/tickets/entries (SSOT PAID).
3) `/api/checkout/status` → FE polling (PAID só com SaleSummary).
4) Refunds: `charge.refunded` ou batch interno (CANCELLED/DELETED/DATE_CHANGED) → tabela `refunds` (dedupeKey), PaymentEvent REFUNDED, tickets/entries marcados REFUNDED, SaleSummary REFUNDED.

Endpoint interno sugerido: `/api/internal/checkout/timeline?purchaseId=...`
- Devolve: payment_events ordenados, sale_summary, sale_lines, tickets/entries, refunds.
- Usado para debug/CS.
