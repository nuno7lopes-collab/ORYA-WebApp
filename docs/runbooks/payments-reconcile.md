# Runbook - Payments reconcile / rollback

Objetivo: reconciliar pagamentos (PaymentIntent/SaleSummary/PaymentEvent) e reprocessar sem double-charge.

## Sinais tipicos
- Pagamento "sucedido" no Stripe mas sem fulfillment.
- Payment/SaleSummary em estado incoerente.
- Checkout bloqueado ou duplicado.

## Diagnostico (ordem)
1) Confirmar status no Stripe (dashboard/CLI) para `paymentIntentId`.
2) Verificar dados internos:
   - Payment (status)
   - PaymentEvent (status, purchaseId)
   - SaleSummary (status)
3) Verificar ops/outbox (DLQ/publish failed).

## Reprocessar (preferir idempotente)
Usar endpoints internos (require `X-ORYA-CRON-SECRET`):
- `POST /api/internal/reprocess/payment-intent` `{ "paymentIntentId": "pi_..." }`
- `POST /api/internal/reprocess/purchase` `{ "purchaseId": "pur_..." }`
- `POST /api/internal/reprocess/stripe-event` `{ "stripeEventId": "evt_..." }`
- `POST /api/internal/reconcile` `{ "minutes": 15 }` (stuck ops)

Exemplo (reprocess paymentIntent):
```bash
curl -sS -X POST \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_..."}' \
  "https://<base>/api/internal/reprocess/payment-intent"
```

## Rollback / refund (quando necessario)
- Preferir admin refund (idempotente via dedupeKey):
  - `POST /api/admin/payments/refund` `{ "paymentIntentId": "pi_..." }`
- Se necessario, executar refund no Stripe e depois reprocessar read-models.

## Checklist de fecho
- [ ] Status Stripe e DB alinhados
- [ ] SaleSummary materializado
- [ ] Nenhum evento em DLQ relacionado
- [ ] UI/ops feed refletem estado final

Notas
- Nunca criar PaymentIntent fora de `/api/payments/intent`.
- Reprocessar primeiro, reembolsar depois (evita double charge).
