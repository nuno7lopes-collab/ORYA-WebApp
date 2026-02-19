#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)

REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-}
APP_ENV=${APP_ENV:-prod}
APP_ENV=$(printf '%s' "$APP_ENV" | tr '[:upper:]' '[:lower:]')
DEFAULT_STACK_NAME="orya-${APP_ENV}"
DEFAULT_REDIS_SECRET_ID="orya/${APP_ENV}/app"
STACK_NAME=${STACK_NAME:-$DEFAULT_STACK_NAME}
REDIS_SECRET_ID=${REDIS_SECRET_ID:-$DEFAULT_REDIS_SECRET_ID}
STATE_DIR=${STATE_DIR:-$ROOT_DIR/scripts/aws/state}
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
STATE_FILE=${STATE_FILE:-$STATE_DIR/${STACK_NAME}-redis-pause-${TIMESTAMP}.json}
DRY_RUN=${DRY_RUN:-false}
ALLOW_REDIS_STOP_WITHOUT_SNAPSHOT=${ALLOW_REDIS_STOP_WITHOUT_SNAPSHOT:-false}

function require_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required binary: $1" >&2; exit 1; }
}

function aws_cmd() {
  local args=(--region "$REGION")
  if [[ -n "$PROFILE" ]]; then
    args=(--profile "$PROFILE" "${args[@]}")
  fi
  aws "${args[@]}" "$@"
}

require_bin aws
require_bin python3

mkdir -p "$STATE_DIR"

secret_json=$(aws_cmd secretsmanager get-secret-value \
  --secret-id "$REDIS_SECRET_ID" \
  --query "SecretString" \
  --output text)

redis_url=$(CURRENT_SECRET="$secret_json" python3 - <<'PY'
import json
import os

doc = json.loads(os.environ["CURRENT_SECRET"])
print(doc.get("REDIS_URL", "").strip())
PY
)

cache_name=$(REDIS_URL="$redis_url" python3 - <<'PY'
import os
from urllib.parse import urlparse

raw = os.environ.get("REDIS_URL", "").strip()
if not raw:
    print("")
    raise SystemExit(0)

host = urlparse(raw).hostname or ""
print(host.split(".")[0] if host else "")
PY
)

cache_json=""
cache_describe_ok=true
if [[ -n "$cache_name" ]]; then
  if ! cache_json=$(aws_cmd elasticache describe-serverless-caches \
    --serverless-cache-name "$cache_name" \
    --query "ServerlessCaches[0]" \
    --output json 2>/dev/null); then
    cache_describe_ok=false
    cache_json=""
  fi
fi

if [[ -n "$cache_name" && "$cache_describe_ok" != "true" && "$ALLOW_REDIS_STOP_WITHOUT_SNAPSHOT" != "true" ]]; then
  echo "Failed to describe Redis cache '$cache_name'; refusing destructive stop without snapshot." >&2
  echo "Set ALLOW_REDIS_STOP_WITHOUT_SNAPSHOT=true to override." >&2
  exit 1
fi

if [[ -n "$cache_json" && "$cache_json" != "null" && "$cache_json" != "None" ]]; then
  PROFILE="$PROFILE" REGION="$REGION" REDIS_SECRET_ID="$REDIS_SECRET_ID" REDIS_URL="$redis_url" CACHE_JSON="$cache_json" STATE_FILE="$STATE_FILE" python3 - <<'PY'
import datetime
import json
import os

state = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "profile": os.environ["PROFILE"],
    "region": os.environ["REGION"],
    "secret_id": os.environ["REDIS_SECRET_ID"],
    "redis_url_before": os.environ["REDIS_URL"],
    "serverless_cache": json.loads(os.environ["CACHE_JSON"]),
}

path = os.path.abspath(os.environ["STATE_FILE"])
with open(path, "w", encoding="utf-8") as f:
    json.dump(state, f, indent=2, sort_keys=True)
print(path)
PY
  echo "Redis state saved: $STATE_FILE"
else
  echo "Redis cache not found from current REDIS_URL; skipping state snapshot."
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true"
  echo "Would delete cache '$cache_name' and clear REDIS_URL in secret '$REDIS_SECRET_ID'."
  exit 0
fi

if [[ -n "$cache_name" ]]; then
  echo "Deleting Redis serverless cache '$cache_name'..."
  aws_cmd elasticache delete-serverless-cache --serverless-cache-name "$cache_name" >/dev/null || true
  until ! aws_cmd elasticache describe-serverless-caches --serverless-cache-name "$cache_name" >/dev/null 2>&1; do
    sleep 5
  done
  echo "Redis cache deleted."
fi

tmp_secret=$(mktemp)
CURRENT_SECRET="$secret_json" python3 - <<'PY' > "$tmp_secret"
import json
import os

doc = json.loads(os.environ["CURRENT_SECRET"])
doc["REDIS_URL"] = ""
print(json.dumps(doc, separators=(",", ":")))
PY

aws_cmd secretsmanager put-secret-value \
  --secret-id "$REDIS_SECRET_ID" \
  --secret-string "file://$tmp_secret" >/dev/null
rm -f "$tmp_secret"

echo "Secret '$REDIS_SECRET_ID' updated (REDIS_URL cleared)."
