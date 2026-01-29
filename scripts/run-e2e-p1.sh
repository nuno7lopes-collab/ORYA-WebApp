#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT="${AWS_ACCOUNT_ID:-495219734037}"
REPORT="reports/p1_closeout_2026-01-29.md"

# Resolve secrets and export env (do not echo values)
get_secret() {
  local name="$1"
  aws secretsmanager get-secret-value --secret-id "orya/prod/${name}" --region "$REGION" --query SecretString --output text
}

export DATABASE_URL="$(get_secret DATABASE_URL)"
export DIRECT_URL="$(get_secret DIRECT_URL)"
export QR_SECRET_KEY="$(get_secret QR_SECRET_KEY)"
export APP_BASE_URL="$(get_secret APP_BASE_URL)"
export NEXT_PUBLIC_BASE_URL="$(get_secret NEXT_PUBLIC_BASE_URL)"
export ORYA_CRON_SECRET="$(get_secret ORYA_CRON_SECRET)"
export SUPABASE_URL="$(get_secret SUPABASE_URL)"
export NEXT_PUBLIC_SUPABASE_URL="$(get_secret NEXT_PUBLIC_SUPABASE_URL)"
export SUPABASE_ANON_KEY="$(get_secret SUPABASE_ANON_KEY)"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(get_secret NEXT_PUBLIC_SUPABASE_ANON_KEY)"
export SUPABASE_SERVICE_ROLE="$(get_secret SUPABASE_SERVICE_ROLE)"
export STRIPE_SECRET_KEY="$(get_secret STRIPE_SECRET_KEY)"
export STRIPE_WEBHOOK_SECRET="$(get_secret STRIPE_WEBHOOK_SECRET)"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$(get_secret NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"
export RESEND_API_KEY="$(get_secret RESEND_API_KEY)"
export RESEND_FROM_EMAIL="$(get_secret RESEND_FROM_EMAIL)"
export APPLE_SIGNIN_SERVICE_ID="$(get_secret APPLE_SIGNIN_SERVICE_ID)"
export APPLE_SIGNIN_REDIRECT_URI="$(get_secret APPLE_SIGNIN_REDIRECT_URI)"
export APPLE_SIGNIN_TEAM_ID="$(get_secret APPLE_SIGNIN_TEAM_ID)"
export APPLE_SIGNIN_KEY_ID="$(get_secret APPLE_SIGNIN_KEY_ID)"
export APPLE_SIGNIN_PRIVATE_KEY_BASE64="$(get_secret APPLE_SIGNIN_PRIVATE_KEY_BASE64)"
export APNS_TEAM_ID="$(get_secret APNS_TEAM_ID)"
export APNS_KEY_ID="$(get_secret APNS_KEY_ID)"
export APNS_PRIVATE_KEY_BASE64="$(get_secret APNS_PRIVATE_KEY_BASE64)"
export APNS_TOPIC="$(get_secret APNS_TOPIC)"
export SENTRY_DSN="$(get_secret SENTRY_DSN)"

# Optional admin auth
export STAGING_ADMIN_EMAIL="$(get_secret STAGING_ADMIN_EMAIL)"
export STAGING_ADMIN_PASSWORD="$(get_secret STAGING_ADMIN_PASSWORD)"
export STAGING_ADMIN_SESSION="$(get_secret STAGING_ADMIN_SESSION)"

mkdir -p reports

echo "# P1 Closeout Report — 2026-01-29" > "$REPORT"
echo "" >> "$REPORT"
echo "## E2E P1 (prod)" >> "$REPORT"

# 1) Migrations
npm run db:deploy >> "$REPORT" 2>&1

# 2) Seed
node scripts/seed_events.js >> "$REPORT" 2>&1

# 3) Flows (placeholders; replace with real endpoints/tools)
# Capture requestId/correlationId for each flow and append to report.

echo "### Flow A: payments intent → webhook → reconcile → ledger" >> "$REPORT"
# TODO: call /api/payments/intent and capture requestId
# TODO: trigger webhook and reconciliation

echo "### Flow B: refund/dispute → ledger adjustments → entitlement invalidation" >> "$REPORT"
# TODO: admin refund flow + check ledger

echo "### Flow C: event ticket → entitlement → check-in" >> "$REPORT"
# TODO: purchase ticket + check-in

echo "" >> "$REPORT"
echo "## DB evidence" >> "$REPORT"
# TODO: include SQL queries/prints once flows run

echo "" >> "$REPORT"
echo "## CloudWatch/Sentry" >> "$REPORT"
# TODO: include logs/traces with requestId/correlationId

echo "" >> "$REPORT"
echo "E2E P1 run completed (manual steps required for requestIds)." >> "$REPORT"
