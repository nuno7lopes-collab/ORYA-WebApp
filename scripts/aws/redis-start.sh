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
STATE_DIR=${STATE_DIR:-$ROOT_DIR/scripts/aws/state}
REDIS_STATE_FILE=${REDIS_STATE_FILE:-}
REDIS_SECRET_ID=${REDIS_SECRET_ID:-$DEFAULT_REDIS_SECRET_ID}
REDIS_WAIT_SECONDS=${REDIS_WAIT_SECONDS:-900}
DRY_RUN=${DRY_RUN:-false}

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

function resolve_state_file() {
  if [[ -n "${REDIS_STATE_FILE:-}" ]]; then
    printf '%s\n' "$REDIS_STATE_FILE"
    return
  fi

  find "$STATE_DIR" -maxdepth 1 -type f -name "${STACK_NAME}-redis-pause-*.json" | sort | tail -n 1
}

require_bin aws
require_bin python3

state_file=$(resolve_state_file)
if [[ -z "$state_file" || ! -f "$state_file" ]]; then
  echo "Redis state file not found. Use REDIS_STATE_FILE or run redis-stop first." >&2
  exit 1
fi

eval "$(REDIS_STATE_FILE="$state_file" python3 - <<'PY'
import json
import os
import shlex
from urllib.parse import urlparse

with open(os.environ["REDIS_STATE_FILE"], "r", encoding="utf-8") as f:
    state = json.load(f)

cache = state.get("serverless_cache") or {}
if not cache:
    raise SystemExit("State file missing serverless_cache payload.")

redis_url_before = (state.get("redis_url_before") or "").strip()
scheme = "rediss"
if redis_url_before:
    parsed = urlparse(redis_url_before)
    if parsed.scheme:
        scheme = parsed.scheme

def emit(key, value):
    print(f"{key}={shlex.quote(str(value if value is not None else ''))}")

emit("RESTORE_CACHE_NAME", cache.get("ServerlessCacheName", ""))
emit("RESTORE_ENGINE", cache.get("Engine", "redis"))
emit("RESTORE_DESCRIPTION", cache.get("Description", ""))
emit("RESTORE_SECURITY_GROUP_IDS", ",".join(cache.get("SecurityGroupIds") or []))
emit("RESTORE_SUBNET_IDS", ",".join(cache.get("SubnetIds") or []))
emit("RESTORE_SNAPSHOT_RETENTION_LIMIT", cache.get("SnapshotRetentionLimit", ""))
emit("RESTORE_DAILY_SNAPSHOT_TIME", cache.get("DailySnapshotTime", ""))
emit("RESTORE_SCHEME", scheme)

usage_limits = {}
cache_usage = cache.get("CacheUsageLimits") or {}
if isinstance(cache_usage, dict):
    ds = cache_usage.get("DataStorage") or {}
    if isinstance(ds, dict):
        ds_out = {}
        if ds.get("Maximum") is not None:
            ds_out["Maximum"] = ds.get("Maximum")
        if ds.get("Unit"):
            ds_out["Unit"] = ds.get("Unit")
        if ds_out:
            usage_limits["DataStorage"] = ds_out
    ecpu = cache_usage.get("ECPUPerSecond") or {}
    if isinstance(ecpu, dict):
        ecpu_out = {}
        if ecpu.get("Maximum") is not None:
            ecpu_out["Maximum"] = ecpu.get("Maximum")
        if ecpu_out:
            usage_limits["ECPUPerSecond"] = ecpu_out

emit("RESTORE_CACHE_USAGE_LIMITS_JSON", json.dumps(usage_limits, separators=(",", ":")) if usage_limits else "")
PY
)"

if [[ -z "${RESTORE_CACHE_NAME:-}" ]]; then
  echo "Invalid redis state file: missing cache name." >&2
  exit 1
fi

status=$(aws_cmd elasticache describe-serverless-caches \
  --serverless-cache-name "$RESTORE_CACHE_NAME" \
  --query "ServerlessCaches[0].Status" \
  --output text 2>/dev/null || true)

if [[ -z "$status" || "$status" == "None" ]]; then
  create_args=(
    elasticache create-serverless-cache
    --serverless-cache-name "$RESTORE_CACHE_NAME"
    --engine "${RESTORE_ENGINE:-redis}"
    --tags "Key=Project,Value=ORYA" "Key=Env,Value=${APP_ENV}" "Key=Name,Value=$RESTORE_CACHE_NAME"
  )
  if [[ -n "${RESTORE_DESCRIPTION:-}" ]]; then
    create_args+=(--description "$RESTORE_DESCRIPTION")
  fi
  if [[ -n "${RESTORE_SECURITY_GROUP_IDS:-}" ]]; then
    IFS=',' read -r -a sg_ids <<< "$RESTORE_SECURITY_GROUP_IDS"
    create_args+=(--security-group-ids "${sg_ids[@]}")
  fi
  if [[ -n "${RESTORE_SUBNET_IDS:-}" ]]; then
    IFS=',' read -r -a subnet_ids <<< "$RESTORE_SUBNET_IDS"
    create_args+=(--subnet-ids "${subnet_ids[@]}")
  fi
  if [[ -n "${RESTORE_CACHE_USAGE_LIMITS_JSON:-}" ]]; then
    create_args+=(--cache-usage-limits "$RESTORE_CACHE_USAGE_LIMITS_JSON")
  fi
  if [[ -n "${RESTORE_SNAPSHOT_RETENTION_LIMIT:-}" ]]; then
    create_args+=(--snapshot-retention-limit "$RESTORE_SNAPSHOT_RETENTION_LIMIT")
  fi
  if [[ -n "${RESTORE_DAILY_SNAPSHOT_TIME:-}" ]]; then
    create_args+=(--daily-snapshot-time "$RESTORE_DAILY_SNAPSHOT_TIME")
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY_RUN=true"
    echo "Would create Redis serverless cache '$RESTORE_CACHE_NAME' from state '$state_file'."
    exit 0
  fi

  echo "Creating Redis serverless cache '$RESTORE_CACHE_NAME'..."
  aws_cmd "${create_args[@]}" >/dev/null
else
  echo "Redis cache '$RESTORE_CACHE_NAME' already exists with status '$status'."
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true"
  echo "Would wait for Redis cache and update secret '$REDIS_SECRET_ID'."
  exit 0
fi

max_attempts=$(( REDIS_WAIT_SECONDS / 5 ))
(( max_attempts < 1 )) && max_attempts=1
for ((attempt=1; attempt<=max_attempts; attempt++)); do
  status=$(aws_cmd elasticache describe-serverless-caches \
    --serverless-cache-name "$RESTORE_CACHE_NAME" \
    --query "ServerlessCaches[0].Status" \
    --output text 2>/dev/null || true)
  if [[ "$status" == "available" ]]; then
    break
  fi
  echo "Waiting for Redis cache '$RESTORE_CACHE_NAME' ($attempt/$max_attempts): status=${status:-not-found}"
  sleep 5
done

status=$(aws_cmd elasticache describe-serverless-caches \
  --serverless-cache-name "$RESTORE_CACHE_NAME" \
  --query "ServerlessCaches[0].Status" \
  --output text 2>/dev/null || true)
if [[ "$status" != "available" ]]; then
  echo "Timed out waiting for Redis cache '$RESTORE_CACHE_NAME' to become available." >&2
  exit 1
fi

endpoint=$(aws_cmd elasticache describe-serverless-caches \
  --serverless-cache-name "$RESTORE_CACHE_NAME" \
  --query "ServerlessCaches[0].Endpoint.Address" \
  --output text)
port=$(aws_cmd elasticache describe-serverless-caches \
  --serverless-cache-name "$RESTORE_CACHE_NAME" \
  --query "ServerlessCaches[0].Endpoint.Port" \
  --output text)

if [[ -z "$endpoint" || "$endpoint" == "None" || -z "$port" || "$port" == "None" ]]; then
  echo "Redis cache endpoint not available for '$RESTORE_CACHE_NAME'." >&2
  exit 1
fi

redis_url="${RESTORE_SCHEME:-rediss}://${endpoint}:${port}"

secret_json=$(aws_cmd secretsmanager get-secret-value \
  --secret-id "$REDIS_SECRET_ID" \
  --query "SecretString" \
  --output text)

tmp_secret=$(mktemp)
CURRENT_SECRET="$secret_json" REDIS_URL_VALUE="$redis_url" python3 - <<'PY' > "$tmp_secret"
import json
import os

doc = json.loads(os.environ["CURRENT_SECRET"])
doc["REDIS_URL"] = os.environ["REDIS_URL_VALUE"]
print(json.dumps(doc, separators=(",", ":")))
PY

aws_cmd secretsmanager put-secret-value \
  --secret-id "$REDIS_SECRET_ID" \
  --secret-string "file://$tmp_secret" >/dev/null
rm -f "$tmp_secret"

echo "Redis restored and secret '$REDIS_SECRET_ID' updated."
