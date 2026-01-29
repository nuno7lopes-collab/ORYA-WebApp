# Runbook — Pagamentos, refunds e disputes

Objetivo: triagem e correcoes nos fluxos de pagamentos, refunds e chargebacks.

## Entrypoints
- `POST /api/admin/payments/refund`
- `POST /api/admin/payments/dispute`
- `POST /api/admin/payments/reprocess`
- `POST /api/internal/reprocess/payment-intent`
- `POST /api/internal/reprocess/purchase`
- `POST /api/internal/reprocess/stripe-event`
- `POST /api/internal/reconcile`

## Checklist de triagem
1) Confirmar `purchaseId`/`paymentIntentId` e status em `payments`.
2) Validar `sale_summaries` (status, totals) e `payment_events`.
3) Verificar `ledger_entries` (GROSS/PLATFORM_FEE/PROCESSOR_FEES_* e refund/chargeback).
4) Validar `entitlements` (ACTIVE/SUSPENDED/REVOKED) e `tickets`.

## Refund manual (admin)
- Endpoint: `POST /api/admin/payments/refund` com `paymentIntentId`.
- Operacao criada: `PROCESS_REFUND_SINGLE`.
- Worker atualiza:
  - `refunds` (registro + dedupe)
  - `payment_events` -> REFUNDED
  - `entitlements` -> REVOKED
  - `payments` -> REFUNDED (via outbox)
  - `ledger_entries` com `REFUND_*`

## Dispute / chargeback
- Stripe webhook dispara `charge.dispute.created` e `charge.dispute.closed`.
- Worker marca:
  - `payments` -> DISPUTED / CHARGEBACK_WON / CHARGEBACK_LOST
  - `entitlements` -> SUSPENDED / ACTIVE / REVOKED
  - `ledger_entries` com `CHARGEBACK_*` e `DISPUTE_FEE` quando aplicavel.

## Queries rapidas (SQL)
```sql
-- status do pagamento
select id, status, processor_fees_status from app_v3.payments where id = '<purchaseId>';

-- ledger entries
select entry_type, amount, causation_id from app_v3.ledger_entries where payment_id = '<purchaseId>' order by created_at;

-- sale summary
select status, total_cents, platform_fee_cents, stripe_fee_cents from app_v3.sale_summaries where purchase_id = '<purchaseId>';
```

## Rollback / replay
- `POST /api/internal/reprocess/purchase` para reprocessar fulfill/outbox.
- `POST /api/internal/reconcile` para requeue de fees.
- Confirmar via `/api/internal/ops/health` e logs.

## Notas
- Nunca editar ledger diretamente.
- Refunds sao idempotentes via `refund:TICKET_ORDER:<purchaseId>`.
