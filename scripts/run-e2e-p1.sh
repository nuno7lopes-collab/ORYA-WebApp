#!/usr/bin/env bash
set -euo pipefail

REPORT_DATE="${REPORT_DATE:-$(date +%F)}"
REPORT="${REPORT:-reports/p1_closeout_${REPORT_DATE}.md}"
REGION="${AWS_REGION:-eu-west-1}"

USE_AWS_SECRETS="${USE_AWS_SECRETS:-0}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
RUN_SEED="${RUN_SEED:-0}"
AUTO_CONFIRM_STRIPE="${AUTO_CONFIRM_STRIPE:-0}"
ALLOW_INSECURE="${ALLOW_INSECURE:-0}"
RUN_DISPUTE="${RUN_DISPUTE:-0}"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-12}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"

ADMIN_HOST_HEADER="${ADMIN_HOST_HEADER:-localhost}"

log() {
  printf "[run-e2e-p1] %s\n" "$*" 1>&2
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    log "Missing env: ${name}"
    exit 1
  fi
}

get_secret() {
  local name="$1"
  aws secretsmanager get-secret-value --secret-id "orya/prod/${name}" --region "$REGION" --query SecretString --output text
}

maybe_load_secrets() {
  if [[ "$USE_AWS_SECRETS" != "1" ]]; then
    return 0
  fi

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
  export SES_REGION="$(get_secret SES_REGION)"
  export SES_IDENTITY_DOMAIN="$(get_secret SES_IDENTITY_DOMAIN)"
  export SES_SMTP_USERNAME="$(get_secret SES_SMTP_USERNAME)"
  export SES_SMTP_PASSWORD="$(get_secret SES_SMTP_PASSWORD)"
  export APPLE_SIGNIN_SERVICE_ID="$(get_secret APPLE_SIGNIN_SERVICE_ID)"
  export APPLE_SIGNIN_REDIRECT_URI="$(get_secret APPLE_SIGNIN_REDIRECT_URI)"
  export APPLE_SIGNIN_TEAM_ID="$(get_secret APPLE_SIGNIN_TEAM_ID)"
  export APPLE_SIGNIN_KEY_ID="$(get_secret APPLE_SIGNIN_KEY_ID)"
  export APPLE_SIGNIN_PRIVATE_KEY_BASE64="$(get_secret APPLE_SIGNIN_PRIVATE_KEY_BASE64)"
  export APNS_TEAM_ID="$(get_secret APNS_TEAM_ID)"
  export APNS_KEY_ID="$(get_secret APNS_KEY_ID)"
  export APNS_PRIVATE_KEY_BASE64="$(get_secret APNS_PRIVATE_KEY_BASE64)"
  export APNS_TOPIC="$(get_secret APNS_TOPIC)"
}

write_report() {
  echo "$*" >> "$REPORT"
}

json_field() {
  local path="$1"
  python3 - "$path" <<'PY'
import json,sys
path = sys.argv[1]
data = json.loads(sys.stdin.read() or "{}")
cur = data
for part in path.split("."):
    if isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
if cur is None:
    print("")
elif isinstance(cur, (dict, list)):
    print(json.dumps(cur))
else:
    print(cur)
PY
}

api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local bearer="${4:-}"
  local extra_header="${5:-}"
  local url="${API_BASE_URL}${path}"

  local curl_args=(-sS -X "$method" -H "Accept: application/json")
  if [[ "$method" != "GET" ]]; then
    curl_args+=(-H "Content-Type: application/json" -d "$body")
  fi
  if [[ -n "$bearer" ]]; then
    curl_args+=(-H "Authorization: Bearer ${bearer}")
  fi
  if [[ -n "$extra_header" ]]; then
    curl_args+=(-H "$extra_header")
  fi
  if [[ "$ALLOW_INSECURE" == "1" ]]; then
    curl_args+=(-k)
  fi

  curl "${curl_args[@]}" "$url"
}

db_query_json() {
  local sql="$1"
  SQL="$sql" node - <<'NODE'
const { Pool } = require("pg");

const sql = process.env.SQL;
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL or DIRECT_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});

pool.query(sql)
  .then((res) => {
    console.log(JSON.stringify(res.rows[0] || {}));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
NODE
}

db_query_table() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="" psql "$DATABASE_URL" -c "$sql"
  else
    SQL="$sql" node - <<'NODE'
const { Pool } = require("pg");

const sql = process.env.SQL;
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL or DIRECT_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});

pool.query(sql)
  .then((res) => {
    console.log(JSON.stringify(res.rows, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
NODE
  fi
}

poll_status() {
  local purchase_id="$1"
  local attempt=1
  local status=""
  while [[ $attempt -le $POLL_ATTEMPTS ]]; do
    local resp
    resp="$(api_call GET "/api/checkout/status?purchaseId=${purchase_id}")"
    status="$(printf "%s" "$resp" | json_field data.status)"
    log "checkout status attempt ${attempt}/${POLL_ATTEMPTS}: ${status}"
    if [[ "$status" == "PAID" || "$status" == "FAILED" || "$status" == "REFUNDED" || "$status" == "DISPUTED" ]]; then
      printf "%s" "$resp"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$POLL_INTERVAL"
  done
  printf "%s" "$resp"
}

maybe_load_secrets

API_BASE_URL="${API_BASE_URL:-${APP_BASE_URL:-${NEXT_PUBLIC_BASE_URL:-}}}"
if [[ -z "$API_BASE_URL" ]]; then
  log "Missing API_BASE_URL / APP_BASE_URL / NEXT_PUBLIC_BASE_URL"
  exit 1
fi

mkdir -p reports

write_report "# P1 Closeout Report — ${REPORT_DATE}"
write_report ""
write_report "## E2E P1 (auto)"

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
  log "Running migrations"
  npm run db:deploy >> "$REPORT" 2>&1
fi

if [[ "$RUN_SEED" == "1" ]]; then
  log "Seeding events"
  node scripts/seed_events.js >> "$REPORT" 2>&1
fi

require_env DATABASE_URL
require_env ORYA_CRON_SECRET
require_env E2E_USER_BEARER
E2E_ADMIN_BEARER="${E2E_ADMIN_BEARER:-}"

write_report ""
write_report "### Flow A: payments intent → confirm → webhook → reconcile → ledger"

paid_info="$(db_query_json "select e.id as event_id, e.slug, tt.id as ticket_type_id, tt.price, tt.currency from app_v3.ticket_types tt join app_v3.events e on e.id = tt.event_id where tt.price > 0 and e.is_deleted = false order by e.starts_at desc limit 1")"
paid_slug="$(printf "%s" "$paid_info" | json_field slug)"
paid_ticket_id="$(printf "%s" "$paid_info" | json_field ticket_type_id)"

if [[ -z "$paid_slug" || -z "$paid_ticket_id" ]]; then
  log "No paid ticket types found."
  exit 1
fi

paid_idempotency="e2e-paid-$(date +%s)"
paid_payload=$(cat <<JSON
{"slug":"${paid_slug}","items":[{"ticketTypeId":${paid_ticket_id},"quantity":1}],"paymentScenario":"SINGLE","paymentMethod":"card","idempotencyKey":"${paid_idempotency}"}
JSON
)

paid_resp="$(api_call POST "/api/payments/intent" "$paid_payload" "$E2E_USER_BEARER")"
write_report ""
write_report "#### Paid checkout (intent)"
write_report "\`\`\`json"
write_report "$paid_resp"
write_report "\`\`\`"

paid_purchase_id="$(printf "%s" "$paid_resp" | json_field data.purchaseId)"
paid_intent_id="$(printf "%s" "$paid_resp" | json_field data.paymentIntentId)"
paid_client_secret="$(printf "%s" "$paid_resp" | json_field data.clientSecret)"

if [[ "$AUTO_CONFIRM_STRIPE" == "1" && -n "$paid_intent_id" ]]; then
  require_env STRIPE_SECRET_KEY
  log "Confirming Stripe PaymentIntent ${paid_intent_id}"
  confirm_resp="$(curl -sS -u "${STRIPE_SECRET_KEY}:" -d "payment_method=pm_card_visa" "https://api.stripe.com/v1/payment_intents/${paid_intent_id}/confirm")"
  write_report ""
  write_report "#### Stripe confirm"
  write_report "\`\`\`json"
  write_report "$confirm_resp"
  write_report "\`\`\`"
else
  if [[ -n "$paid_client_secret" ]]; then
    log "Stripe confirm skipped (AUTO_CONFIRM_STRIPE=0). clientSecret: ${paid_client_secret}"
  fi
fi

if [[ -n "$paid_purchase_id" ]]; then
  status_resp="$(poll_status "$paid_purchase_id")"
  write_report ""
  write_report "#### Checkout status"
  write_report "\`\`\`json"
  write_report "$status_resp"
  write_report "\`\`\`"
fi

write_report ""
write_report "### Flow B: refund/dispute → ledger adjustments → entitlement invalidation"

if [[ -n "$E2E_ADMIN_BEARER" && -n "$paid_intent_id" ]]; then
  refund_payload=$(cat <<JSON
{"paymentIntentId":"${paid_intent_id}"}
JSON
)
  refund_resp="$(api_call POST "/api/admin/payments/refund" "$refund_payload" "$E2E_ADMIN_BEARER" "X-Forwarded-Host: ${ADMIN_HOST_HEADER}")"
  write_report ""
  write_report "#### Admin refund"
  write_report "\`\`\`json"
  write_report "$refund_resp"
  write_report "\`\`\`"

  if [[ "$RUN_DISPUTE" == "1" ]]; then
    sale_info="$(db_query_json "select id from app_v3.sale_summaries where payment_intent_id = '${paid_intent_id}' order by created_at desc limit 1")"
    sale_id="$(printf "%s" "$sale_info" | json_field id)"
    if [[ -n "$sale_id" ]]; then
      dispute_payload=$(cat <<JSON
{"saleSummaryId":${sale_id},"reason":"FRAUDULENT"}
JSON
)
      dispute_resp="$(api_call POST "/api/admin/payments/dispute" "$dispute_payload" "$E2E_ADMIN_BEARER" "X-Forwarded-Host: ${ADMIN_HOST_HEADER}")"
      write_report ""
      write_report "#### Admin dispute"
      write_report "\`\`\`json"
      write_report "$dispute_resp"
      write_report "\`\`\`"
    fi
  fi
else
  write_report ""
  write_report "_Admin refund/dispute skipped (missing E2E_ADMIN_BEARER or paymentIntentId)._"
fi

write_report ""
write_report "### Flow C: event ticket → entitlement → check-in"

free_info="$(db_query_json "select e.id as event_id, e.slug, tt.id as ticket_type_id, tt.price, tt.currency from app_v3.ticket_types tt join app_v3.events e on e.id = tt.event_id where tt.price = 0 and e.is_deleted = false order by e.starts_at desc limit 1")"
free_slug="$(printf "%s" "$free_info" | json_field slug)"
free_ticket_id="$(printf "%s" "$free_info" | json_field ticket_type_id)"
free_event_id="$(printf "%s" "$free_info" | json_field event_id)"

if [[ -n "$free_slug" && -n "$free_ticket_id" ]]; then
  free_idempotency="e2e-free-$(date +%s)"
  free_payload=$(cat <<JSON
{"slug":"${free_slug}","items":[{"ticketTypeId":${free_ticket_id},"quantity":1}],"paymentScenario":"FREE_CHECKOUT","paymentMethod":"card","idempotencyKey":"${free_idempotency}"}
JSON
)
  free_resp="$(api_call POST "/api/payments/intent" "$free_payload" "$E2E_USER_BEARER")"
  write_report ""
  write_report "#### Free checkout (intent)"
  write_report "\`\`\`json"
  write_report "$free_resp"
  write_report "\`\`\`"

  free_purchase_id="$(printf "%s" "$free_resp" | json_field data.purchaseId)"

  if [[ -n "$free_purchase_id" ]]; then
    reconcile_payload='{"minutes":1}'
    reconcile_resp="$(api_call POST "/api/internal/reconcile" "$reconcile_payload" "" "X-ORYA-CRON-SECRET: ${ORYA_CRON_SECRET}")"
    write_report ""
    write_report "#### Reconcile"
    write_report "\`\`\`json"
    write_report "$reconcile_resp"
    write_report "\`\`\`"

    status_resp="$(poll_status "$free_purchase_id")"
    write_report ""
    write_report "#### Checkout status (free)"
    write_report "\`\`\`json"
    write_report "$status_resp"
    write_report "\`\`\`"

    ent_info="$(db_query_json "select id, event_id from app_v3.entitlements where purchase_id = '${free_purchase_id}' order by created_at desc limit 1")"
    ent_id="$(printf "%s" "$ent_info" | json_field id)"
    ent_event_id="$(printf "%s" "$ent_info" | json_field event_id)"
    if [[ -n "$ent_id" && -n "$ent_event_id" ]]; then
      wallet_resp="$(api_call GET "/api/me/wallet/${ent_id}" "" "$E2E_USER_BEARER")"
      qr_token="$(printf "%s" "$wallet_resp" | json_field qrToken)"
      write_report ""
      write_report "#### Wallet QR token"
      write_report "\`\`\`json"
      write_report "$wallet_resp"
      write_report "\`\`\`"
      if [[ -n "$qr_token" ]]; then
        checkin_payload=$(cat <<JSON
{"qrPayload":"${qr_token}","eventId":${ent_event_id},"deviceId":"e2e-script"}
JSON
)
        checkin_resp="$(api_call POST "/api/internal/checkin/consume" "$checkin_payload" "" "X-ORYA-CRON-SECRET: ${ORYA_CRON_SECRET}")"
        write_report ""
        write_report "#### Check-in consume"
        write_report "\`\`\`json"
        write_report "$checkin_resp"
        write_report "\`\`\`"
      fi
    fi
  fi
else
  write_report "_Free checkout skipped (no free ticket types found)._"
fi

write_report ""
write_report "## DB evidence (sample)"
db_query_table "select id,purchase_id,payment_intent_id,status,total_cents,platform_fee_cents,stripe_fee_cents from app_v3.sale_summaries order by created_at desc limit 3;" >> "$REPORT" 2>&1

write_report ""
write_report "## Notes"
write_report "- Use AUTO_CONFIRM_STRIPE=1 to auto-confirm PaymentIntent (requires STRIPE_SECRET_KEY)."
write_report "- Admin flows require E2E_ADMIN_BEARER (Supabase JWT) and will skip MFA when host != admin.orya.pt."
write_report "- Internal endpoints require ORYA_CRON_SECRET."
