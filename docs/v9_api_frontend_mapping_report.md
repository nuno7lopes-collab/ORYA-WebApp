# V9 API → Frontend Mapping Report

CSV: docs/v9_api_frontend_mapping.csv

## Internal/Cron endpoints (no UI required)
- /api/internal/worker/operations
- /api/internal/outbox/replay
- /api/internal/outbox/dlq
- /api/cron/operations
- /api/internal/reconcile
- /api/internal/reprocess/purchase
- /api/internal/reprocess/payment-intent
- /api/internal/reprocess/stripe-event
- /api/internal/checkout/timeline
- /api/internal/checkin/consume
- /api/cron/payouts/release
- /api/internal/analytics/rollup

## External/Webhook endpoints (no UI required)
- /api/organizacao/payouts/webhook
- /api/stripe/webhook
- /api/webhooks/stripe

## Endpoints referenced in v9_close_plan without frontend usage
- Nota: lista calculada por strings `/api/...` no frontend; endpoints aqui podem ser mobile/server-only.
- none
