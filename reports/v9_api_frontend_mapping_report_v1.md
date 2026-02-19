# V9 API → Frontend Mapping Report

CSV: reports/v9_api_frontend_mapping_v1.csv

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

## External/Webhook endpoints (no UI required)
- /api/org-system/payouts/webhook
- /api/stripe/webhook
- /api/webhooks/stripe

## Endpoints referenced in p0_endpoints manifest without frontend usage
- Nota: lista calculada por strings `/api/...` no frontend; endpoints aqui podem ser mobile/server-only.
- /api/servicos/[id]/creditos/checkout
- /api/org/[orgId]/payouts/status
- /api/org/[orgId]/payouts/list
- /api/org/[orgId]/payouts/summary
- /api/org/[orgId]/payouts/settings
- /api/org/[orgId]/payouts/connect
