#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)

STATE_FILE=${STATE_FILE:-$ROOT_DIR/scripts/aws/state/orya-prod-pause.json}
DRY_RUN=${DRY_RUN:-false}
RESUME_REDIS_MODE=${RESUME_REDIS_MODE:-auto}
REDIS_STATE_FILE=${REDIS_STATE_FILE:-}
REDIS_SECRET_ID=${REDIS_SECRET_ID:-orya/prod/app}
REDIS_WAIT_SECONDS=${REDIS_WAIT_SECONDS:-900}

function require_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required binary: $1" >&2; exit 1; }
}

require_bin aws
require_bin python3

if [[ ! -f "$STATE_FILE" ]]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

EXPORTS=$(python3 - <<'PY'
import json, os, shlex

state = json.load(open(os.environ["STATE_FILE"], "r", encoding="utf-8"))
params = state.get("stack_parameters", {})

def norm(v):
    if v is None:
        return ""
    if isinstance(v, str) and v.strip() == "None":
        return ""
    return v

def emit(k, v):
    print(f"{k}={shlex.quote(str(norm(v)))}")

emit("STATE_PROFILE", state.get("profile", ""))
emit("STATE_REGION", state.get("region", ""))
emit("STATE_STACK_NAME", state.get("stack_name", ""))

keys = [
    "VpcId",
    "PublicSubnets",
    "PrivateSubnets",
    "ServiceSubnets",
    "AssignPublicIp",
    "WebImage",
    "WorkerImage",
    "EnableWorker",
    "EnableOutboxSchedule",
    "WebDesiredCount",
    "WorkerDesiredCount",
    "CreateALB",
    "CreateDnsRecords",
    "HostedZoneId",
    "AppDomain",
    "AdminDomain",
    "AlbCertificateArn",
]

for key in keys:
    emit(key, params.get(key, ""))

ecs = state.get("ecs", {})
emit("STATE_WEB_DESIRED", ecs.get("web_desired", 0))
emit("STATE_WORKER_DESIRED", ecs.get("worker_desired", 0))
PY
)

eval "$EXPORTS"

PROFILE=${AWS_PROFILE:-${STATE_PROFILE:-codex}}
REGION=${AWS_REGION:-${STATE_REGION:-eu-west-1}}
STACK_NAME=${STACK_NAME:-${STATE_STACK_NAME:-orya-prod}}

function aws_cmd() {
  aws --profile "$PROFILE" --region "$REGION" "$@"
}

function resolve_redis_state_file() {
  if [[ -n "${REDIS_STATE_FILE:-}" ]]; then
    printf '%s\n' "$REDIS_STATE_FILE"
    return
  fi

  local state_dir="$ROOT_DIR/scripts/aws/state"
  if [[ ! -d "$state_dir" ]]; then
    return
  fi

  find "$state_dir" -maxdepth 1 -type f -name 'orya-prod-redis-pause-*.json' | sort | tail -n 1
}

function load_redis_state() {
  local redis_state_path="$1"
  local redis_exports

  redis_exports=$(REDIS_STATE_FILE="$redis_state_path" python3 - <<'PY'
import json
import os
import shlex
import sys
from urllib.parse import urlparse

path = os.environ["REDIS_STATE_FILE"]
with open(path, "r", encoding="utf-8") as f:
    state = json.load(f)

cache = state.get("serverless_cache") or {}
if not isinstance(cache, dict) or not cache:
    sys.exit(0)

def norm(v):
    if v is None:
        return ""
    if isinstance(v, str) and v.strip() == "None":
        return ""
    return v

def emit(key, value):
    print(f"{key}={shlex.quote(str(norm(value)))}")

emit("REDIS_STATE_FILE_RESOLVED", path)
emit("REDIS_CACHE_NAME", cache.get("ServerlessCacheName", ""))
emit("REDIS_ENGINE", cache.get("Engine", "redis"))
emit("REDIS_DESCRIPTION", cache.get("Description", ""))
emit("REDIS_SECURITY_GROUP_IDS", ",".join(cache.get("SecurityGroupIds") or []))
emit("REDIS_SUBNET_IDS", ",".join(cache.get("SubnetIds") or []))
emit("REDIS_SNAPSHOT_RETENTION_LIMIT", cache.get("SnapshotRetentionLimit", ""))
emit("REDIS_DAILY_SNAPSHOT_TIME", cache.get("DailySnapshotTime", ""))

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

emit(
    "REDIS_CACHE_USAGE_LIMITS_JSON",
    json.dumps(usage_limits, separators=(",", ":")) if usage_limits else "",
)

redis_url_before = state.get("redis_url_before", "")
scheme = ""
if redis_url_before:
    parsed = urlparse(redis_url_before)
    scheme = parsed.scheme
emit("REDIS_SCHEME", scheme or "rediss")
PY
)

  if [[ -z "$redis_exports" ]]; then
    return 1
  fi

  eval "$redis_exports"
}

function wait_for_redis_available() {
  local cache_name="$1"
  local max_attempts=$(( REDIS_WAIT_SECONDS / 5 ))
  (( max_attempts < 1 )) && max_attempts=1
  local status=""

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    status=$(aws_cmd elasticache describe-serverless-caches \
      --serverless-cache-name "$cache_name" \
      --query "ServerlessCaches[0].Status" \
      --output text 2>/dev/null || true)
    if [[ "$status" == "available" ]]; then
      echo "Redis cache '$cache_name' is available."
      return 0
    fi
    echo "Waiting for Redis cache '$cache_name' ($attempt/$max_attempts): status=${status:-not-found}"
    sleep 5
  done

  echo "Timed out waiting for Redis cache '$cache_name' to become available." >&2
  return 1
}

function update_redis_url_secret() {
  local redis_url="$1"
  local current_secret
  current_secret=$(aws_cmd secretsmanager get-secret-value \
    --secret-id "$REDIS_SECRET_ID" \
    --query "SecretString" \
    --output text)

  local current_url
  current_url=$(CURRENT_SECRET="$current_secret" python3 - <<'PY'
import json
import os

doc = json.loads(os.environ["CURRENT_SECRET"])
print(doc.get("REDIS_URL", ""))
PY
)

  if [[ "$current_url" == "$redis_url" ]]; then
    echo "Secret '$REDIS_SECRET_ID' already points to Redis endpoint."
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY_RUN=true"
    echo "Would update secret '$REDIS_SECRET_ID' REDIS_URL to '$redis_url'."
    return 0
  fi

  local tmp_secret
  tmp_secret=$(mktemp)
  CURRENT_SECRET="$current_secret" REDIS_URL_VALUE="$redis_url" python3 - <<'PY' > "$tmp_secret"
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
  echo "Secret '$REDIS_SECRET_ID' updated with Redis endpoint."
}

function ensure_resume_redis() {
  if [[ "${RESUME_REDIS_MODE}" == "skip" ]]; then
    echo "Skipping Redis restore (RESUME_REDIS_MODE=skip)."
    return 0
  fi

  local redis_state_path
  redis_state_path=$(resolve_redis_state_file)
  if [[ -z "$redis_state_path" ]]; then
    if [[ "${RESUME_REDIS_MODE}" == "require" ]]; then
      echo "Redis state file is required but not found." >&2
      return 1
    fi
    echo "No Redis state file found; skipping Redis restore."
    return 0
  fi

  if [[ ! -f "$redis_state_path" ]]; then
    if [[ "${RESUME_REDIS_MODE}" == "require" ]]; then
      echo "Redis state file not found: $redis_state_path" >&2
      return 1
    fi
    echo "Redis state file not found: $redis_state_path (skipping)."
    return 0
  fi

  if ! load_redis_state "$redis_state_path"; then
    if [[ "${RESUME_REDIS_MODE}" == "require" ]]; then
      echo "Failed to parse Redis state file: $redis_state_path" >&2
      return 1
    fi
    echo "Failed to parse Redis state file: $redis_state_path (skipping)."
    return 0
  fi

  if [[ -z "${REDIS_CACHE_NAME:-}" ]]; then
    if [[ "${RESUME_REDIS_MODE}" == "require" ]]; then
      echo "Redis state file missing cache name: $redis_state_path" >&2
      return 1
    fi
    echo "Redis state missing cache name (skipping)."
    return 0
  fi

  echo "Using Redis state: ${REDIS_STATE_FILE_RESOLVED}"

  local status
  status=$(aws_cmd elasticache describe-serverless-caches \
    --serverless-cache-name "$REDIS_CACHE_NAME" \
    --query "ServerlessCaches[0].Status" \
    --output text 2>/dev/null || true)

  if [[ "$status" == "deleting" ]]; then
    echo "Redis cache '$REDIS_CACHE_NAME' is deleting; waiting..."
    local delete_wait_attempts=$(( REDIS_WAIT_SECONDS / 5 ))
    (( delete_wait_attempts < 1 )) && delete_wait_attempts=1
    for ((attempt=1; attempt<=delete_wait_attempts; attempt++)); do
      sleep 5
      status=$(aws_cmd elasticache describe-serverless-caches \
        --serverless-cache-name "$REDIS_CACHE_NAME" \
        --query "ServerlessCaches[0].Status" \
        --output text 2>/dev/null || true)
      if [[ -z "$status" || "$status" == "None" ]]; then
        status=""
        break
      fi
      echo "Waiting Redis delete to finish ($attempt/$delete_wait_attempts): status=$status"
    done
  fi

  if [[ -z "$status" || "$status" == "None" ]]; then
    local create_args=(
      elasticache create-serverless-cache
      --serverless-cache-name "$REDIS_CACHE_NAME"
      --engine "${REDIS_ENGINE:-redis}"
      --tags "Key=Project,Value=ORYA" "Key=Env,Value=prod" "Key=Name,Value=$REDIS_CACHE_NAME"
    )
    if [[ -n "${REDIS_DESCRIPTION:-}" ]]; then
      create_args+=(--description "$REDIS_DESCRIPTION")
    fi
    if [[ -n "${REDIS_SECURITY_GROUP_IDS:-}" ]]; then
      local sg_ids=()
      IFS=',' read -r -a sg_ids <<< "$REDIS_SECURITY_GROUP_IDS"
      create_args+=(--security-group-ids "${sg_ids[@]}")
    fi
    if [[ -n "${REDIS_SUBNET_IDS:-}" ]]; then
      local subnet_ids=()
      IFS=',' read -r -a subnet_ids <<< "$REDIS_SUBNET_IDS"
      create_args+=(--subnet-ids "${subnet_ids[@]}")
    fi
    if [[ -n "${REDIS_CACHE_USAGE_LIMITS_JSON:-}" ]]; then
      create_args+=(--cache-usage-limits "$REDIS_CACHE_USAGE_LIMITS_JSON")
    fi
    if [[ -n "${REDIS_SNAPSHOT_RETENTION_LIMIT:-}" ]]; then
      create_args+=(--snapshot-retention-limit "$REDIS_SNAPSHOT_RETENTION_LIMIT")
    fi
    if [[ -n "${REDIS_DAILY_SNAPSHOT_TIME:-}" ]]; then
      create_args+=(--daily-snapshot-time "$REDIS_DAILY_SNAPSHOT_TIME")
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "DRY_RUN=true"
      echo "Would create Redis serverless cache '$REDIS_CACHE_NAME'."
      echo "Would wait for availability and update secret '$REDIS_SECRET_ID'."
      return 0
    fi

    echo "Creating Redis serverless cache '$REDIS_CACHE_NAME'..."
    aws_cmd "${create_args[@]}" >/dev/null
    status="creating"
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY_RUN=true"
    echo "Would verify Redis cache '$REDIS_CACHE_NAME' and refresh secret '$REDIS_SECRET_ID'."
    return 0
  fi

  if [[ "$status" != "available" ]]; then
    wait_for_redis_available "$REDIS_CACHE_NAME"
  fi

  local endpoint port scheme redis_url
  endpoint=$(aws_cmd elasticache describe-serverless-caches \
    --serverless-cache-name "$REDIS_CACHE_NAME" \
    --query "ServerlessCaches[0].Endpoint.Address" \
    --output text)
  port=$(aws_cmd elasticache describe-serverless-caches \
    --serverless-cache-name "$REDIS_CACHE_NAME" \
    --query "ServerlessCaches[0].Endpoint.Port" \
    --output text)

  if [[ -z "$endpoint" || "$endpoint" == "None" || -z "$port" || "$port" == "None" ]]; then
    echo "Redis cache endpoint not available for '$REDIS_CACHE_NAME'." >&2
    return 1
  fi

  scheme=${REDIS_SCHEME:-rediss}
  redis_url="${scheme}://${endpoint}:${port}"
  update_redis_url_secret "$redis_url"
}

WITH_ALB_VALUE=${CreateALB:-true}
CREATE_DNS_VALUE=${CreateDnsRecords:-false}

args=("--stack-name" "$STACK_NAME")
if [[ -n "${VpcId:-}" ]]; then args+=("--vpc-id" "$VpcId"); fi
if [[ -n "${PublicSubnets:-}" ]]; then args+=("--public-subnets" "$PublicSubnets"); fi
if [[ -n "${PrivateSubnets:-}" ]]; then args+=("--private-subnets" "$PrivateSubnets"); fi
if [[ -n "${ServiceSubnets:-}" ]]; then args+=("--service-subnets" "$ServiceSubnets"); fi
if [[ -n "${AssignPublicIp:-}" ]]; then args+=("--assign-public-ip" "$AssignPublicIp"); fi
if [[ -n "${AlbCertificateArn:-}" ]]; then args+=("--alb-cert-arn" "$AlbCertificateArn"); fi
if [[ -n "${HostedZoneId:-}" ]]; then args+=("--hosted-zone-id" "$HostedZoneId"); fi
if [[ -n "${AppDomain:-}" ]]; then args+=("--app-domain" "$AppDomain"); fi
if [[ -n "${AdminDomain:-}" ]]; then args+=("--admin-domain" "$AdminDomain"); fi
args+=("--create-dns" "$CREATE_DNS_VALUE")

export ENABLE_WORKER="${EnableWorker:-true}"
export ENABLE_OUTBOX_SCHEDULE="${EnableOutboxSchedule:-false}"
export WEB_IMAGE="${WebImage:-}"
export WORKER_IMAGE="${WorkerImage:-}"

if [[ -n "${STATE_WEB_DESIRED:-}" && "${STATE_WEB_DESIRED:-}" != "None" ]]; then
  export WEB_DESIRED_COUNT="$STATE_WEB_DESIRED"
else
  export WEB_DESIRED_COUNT="${WebDesiredCount:-1}"
fi

if [[ -n "${STATE_WORKER_DESIRED:-}" && "${STATE_WORKER_DESIRED:-}" != "None" ]]; then
  export WORKER_DESIRED_COUNT="$STATE_WORKER_DESIRED"
else
  export WORKER_DESIRED_COUNT="${WorkerDesiredCount:-1}"
fi

ensure_resume_redis

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true"
  echo "Would run: scripts/deploy-cf.sh --with-alb $WITH_ALB_VALUE --resume ${args[*]}"
  exit 0
fi

"$ROOT_DIR/scripts/deploy-cf.sh" \
  --with-alb "$WITH_ALB_VALUE" \
  --resume \
  "${args[@]}"

echo "Start complete. ECS services resumed to previous desired counts."
