# AWS Release Runbook — ORYA-WebApp

## Scope
- Production release for ORYA-WebApp (AWS).
- Source branch: main (from developer).
- Infra status snapshot (2026-02-02): AWS + Supabase isolation + Apple readiness já concluídos; este runbook não implica alterações de infraestrutura.

## Preconditions
- Secrets configured in AWS Secrets Manager / environment.
- DNS + network reachability OK for DATABASE_URL and DIRECT_URL.
- ORYA_CRON_SECRET set (required for internal/cron routes).
- Stripe webhooks updated to the production base URL.

## Required environment variables
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE
- DATABASE_URL
- DIRECT_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- QR_SECRET_KEY
- RESEND_API_KEY
- ORYA_CRON_SECRET

## Recommended / optional environment variables
- STRIPE_PAYOUTS_WEBHOOK_SECRET
- APP_BASE_URL / NEXT_PUBLIC_BASE_URL
- ADMIN_HOSTS, ADMIN_ALLOWED_IPS, CANONICAL_HOST, CANONICAL_PROTOCOL, FORCE_HTTPS, ALLOW_LOCAL_ADMIN
- SUPABASE_STORAGE_BUCKET_UPLOADS, SUPABASE_STORAGE_BUCKET_AVATARS, SUPABASE_STORAGE_BUCKET_EVENT_COVERS
- STORE_ENABLED

## Release steps
1) Preflight
   - `npm install`
   - `npm run db:preflight`
   - Optional: `npm run db:status`

2) Migrations
   - `npm run db:deploy`
   - Migration note: `20260128_payment_intent_links` adds `stripe_payment_intent_id` + indexes to `payment_events` and `transactions`.

3) Build
   - `npm run build`

4) Start
   - `npm run start` (or AWS service start command)

5) Smoke tests
   - Internal health: `GET /api/internal/ops/health` with `X-ORYA-CRON-SECRET`.
   - Auth: login + refresh works.
   - Core flows: org dashboard loads, payment intent creates, webhook returns 2xx.
   - Headers: responses include `x-orya-request-id` and `x-orya-correlation-id`.

## Rollback plan
- Roll back app to previous build artifact / image.
- If a DB rollback is required:
  - Restore the latest DB snapshot.
  - Optionally mark the migration as rolled back:
    - `npx prisma migrate resolve --rolled-back 20260128_payment_intent_links`
- Re-run smoke tests.

## Post-deploy verification
- Monitor error logs, payments, outbox consumers, and webhook retries.
- Confirm cron/worker endpoints are reachable with ORYA_CRON_SECRET.
