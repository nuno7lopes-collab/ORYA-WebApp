# Envs Required (production + CI)

This doc lists the required env vars for core services and where to store them.
Keep secrets out of git. Use single-line base64 for Apple keys.

## Core runtime (server)
- DATABASE_URL
- DIRECT_URL (Prisma)
- APP_ENV (prod|test; optional override, otherwise inferred from host)
- QR_SECRET_KEY
- SES_REGION
- SES_IDENTITY_DOMAIN
- SES_SMTP_USERNAME
- SES_SMTP_PASSWORD
- EMAIL_FROM (optional, defaults to noreply@SES_IDENTITY_DOMAIN)
- APP_BASE_URL / NEXT_PUBLIC_BASE_URL (recommended, used by checkout flows)
- ORYA_CRON_SECRET (required for /api/internal + /api/cron)

## Supabase
Required:
- SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE

Optional:
- SUPABASE_STORAGE_BUCKET_UPLOADS
- SUPABASE_STORAGE_BUCKET_AVATARS
- SUPABASE_STORAGE_BUCKET_EVENT_COVERS
- SUPABASE_STORAGE_SIGNED_URLS
- SUPABASE_STORAGE_SIGNED_TTL_SECONDS
- SUPABASE_COOKIE_DOMAIN / NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN

## Stripe
Required:
- STRIPE_SECRET_KEY_LIVE
- STRIPE_SECRET_KEY_TEST
- STRIPE_WEBHOOK_SECRET_LIVE
- STRIPE_WEBHOOK_SECRET_TEST
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST

Optional:
- STRIPE_SECRET_KEY (fallback)
- STRIPE_WEBHOOK_SECRET (fallback)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (fallback)
- STRIPE_PAYOUTS_WEBHOOK_SECRET (Stripe Connect payouts webhook)
- STRIPE_PAYOUTS_WEBHOOK_SECRET_LIVE
- STRIPE_PAYOUTS_WEBHOOK_SECRET_TEST
- STRIPE_FEE_* (only if overriding fee defaults)

## Apple Sign-In
Required:
- APPLE_SIGNIN_SERVICE_ID
- APPLE_SIGNIN_REDIRECT_URI
- APPLE_SIGNIN_TEAM_ID
- APPLE_SIGNIN_KEY_ID
- APPLE_SIGNIN_PRIVATE_KEY_BASE64

## APNS (token-based)
Required:
- APNS_TEAM_ID
- APNS_KEY_ID
- APNS_PRIVATE_KEY_BASE64
- APNS_TOPIC

## Apple Maps
Required:
- APPLE_MAPS_TEAM_ID
- APPLE_MAPS_KEY_ID
- APPLE_MAPS_PRIVATE_KEY_BASE64

Optional:
- APPLE_MAPS_TOKEN_TTL_SECONDS (defaults to 900 seconds)

## Apple .p8 -> base64 (single line)
1) Download the .p8 (e.g. AuthKey_ABC123.p8).
2) Encode to single-line base64:
   - macOS: `base64 -i AuthKey_ABC123.p8 | tr -d '\n'`
   - Linux: `base64 -w 0 AuthKey_ABC123.p8`
3) Paste into the *_PRIVATE_KEY_BASE64 env var.
4) Rotate keys periodically and keep the raw .p8 off the repo.

## AWS (Secrets Manager / App Runner / ECS)
- Store each env var as a secret (one value per key).
- Keep base64 strings as-is (single line, no quotes).
- Wire secrets into the service/task env.
- Separate prod/staging secrets and rotate on schedule.

Current groups (documented as configured in PROD/DEV):
- `orya/prod/app`, `orya/prod/supabase`, `orya/prod/payments`, `orya/prod/apple`, `orya/prod/email`, `orya/prod/admin`
- `orya/dev/app`, `orya/dev/supabase`, `orya/dev/payments`, `orya/dev/apple`, `orya/dev/email`, `orya/dev/admin`

Infra evidence:
- `reports/p_infra_2026-01-30.md`
- `reports/p_email_2026-01-31.md`
- `reports/test_env_isolation_2026-01-31.md`

## AWS deploy
- Store env vars in AWS Secrets Manager/SSM.
- Attach them to App Runner/ECS task definitions by environment.
- Base64 values must be single line (no quotes, no line breaks).
- Redeploy services after changes.

## Local dev / CI
- Use `.env` or `.env.local` locally.
- CI can use dummy values for non-prod gates (do not use real secrets).

## Client (optional)
- NEXT_PUBLIC_APP_ENV (prod|test override for client)
