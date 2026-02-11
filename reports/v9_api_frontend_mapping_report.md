# V9 API → Frontend Mapping Report

CSV: reports/v9_api_frontend_mapping.csv

## Internal/Cron endpoints (no UI required)
- /api/internal/reconcile
- /api/internal/outbox/dlq
- /api/internal/outbox/replay
- /api/internal/worker/operations
- /api/internal/reprocess/purchase
- /api/internal/reprocess/payment-intent
- /api/internal/reprocess/stripe-event
- /api/internal/checkout/timeline
- /api/internal/checkin/consume
- /api/cron/operations
- /api/cron/payouts/release

## External/Webhook endpoints (no UI required)
- /api/organizacao/payouts/webhook
- /api/stripe/webhook
- /api/webhooks/stripe

## Endpoints referenced in ssot_registry (P0 list) without frontend usage
- Nota: lista calculada por strings `/api/...` no frontend; endpoints aqui podem ser mobile/server-only.
- /api/payments/intent
- /api/checkout/status
- /api/checkout/resale
- /api/convites/[token]/checkout
- /api/cobrancas/[token]/checkout
- /api/servicos/[id]/checkout
- /api/organizacao/reservas/[id]/checkout
- /api/padel/pairings/[id]/checkout
- /api/admin/payments/refund
- /api/admin/payments/dispute
- /api/admin/payments/reprocess
- /api/admin/refunds/list
- /api/admin/refunds/retry
- /api/organizacao/refunds/list
- /api/organizacao/payouts/status
- /api/organizacao/payouts/list
- /api/organizacao/payouts/summary
- /api/organizacao/payouts/settings
- /api/organizacao/payouts/connect
