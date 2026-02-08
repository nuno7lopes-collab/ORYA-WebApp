#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)

REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-codex}
STACK_NAME=${STACK_NAME:-orya-prod}
STATE_FILE=${STATE_FILE:-$ROOT_DIR/scripts/aws/state/${STACK_NAME}-pause.json}
DRY_RUN=${DRY_RUN:-false}

function aws_cmd() {
  aws --profile "$PROFILE" --region "$REGION" "$@"
}

function require_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required binary: $1" >&2; exit 1; }
}

require_bin aws
require_bin python3

STACK_STATUS=$(aws_cmd cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text)
case "$STACK_STATUS" in
  *IN_PROGRESS|*FAILED)
    echo "Stack not stable: $STACK_STATUS" >&2
    exit 1
    ;;
esac

STACK_PARAMS_JSON=$(aws_cmd cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Parameters" \
  --output json)

CLUSTER=$(aws_cmd cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue | [0]" \
  --output text)
WEB_SERVICE=$(aws_cmd cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebServiceName'].OutputValue | [0]" \
  --output text)
WORKER_SERVICE=$(aws_cmd cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WorkerServiceName'].OutputValue | [0]" \
  --output text)

if [[ -z "$CLUSTER" || "$CLUSTER" == "None" ]]; then
  echo "Unable to resolve ECS cluster from stack outputs." >&2
  exit 1
fi

WEB_DESIRED=0
if [[ -n "$WEB_SERVICE" && "$WEB_SERVICE" != "None" ]]; then
  WEB_DESIRED=$(aws_cmd ecs describe-services \
    --cluster "$CLUSTER" \
    --services "$WEB_SERVICE" \
    --query "services[0].desiredCount" \
    --output text 2>/dev/null || echo 0)
fi

WORKER_DESIRED=0
if [[ -n "$WORKER_SERVICE" && "$WORKER_SERVICE" != "None" ]]; then
  WORKER_DESIRED=$(aws_cmd ecs describe-services \
    --cluster "$CLUSTER" \
    --services "$WORKER_SERVICE" \
    --query "services[0].desiredCount" \
    --output text 2>/dev/null || echo 0)
fi

if [[ "$WEB_DESIRED" == "None" || -z "$WEB_DESIRED" ]]; then
  WEB_DESIRED=0
fi
if [[ "$WORKER_DESIRED" == "None" || -z "$WORKER_DESIRED" ]]; then
  WORKER_DESIRED=0
fi

export STACK_PARAMS_JSON STATE_FILE REGION PROFILE STACK_NAME CLUSTER WEB_SERVICE WORKER_SERVICE WEB_DESIRED WORKER_DESIRED

python3 - <<'PY'
import json, os
from datetime import datetime, timezone

params = json.loads(os.environ["STACK_PARAMS_JSON"])
param_map = {p.get("ParameterKey"): p.get("ParameterValue", "") for p in params}

def norm(v):
    if v is None:
        return ""
    if isinstance(v, str) and v.strip() == "None":
        return ""
    return v

state = {
    "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "profile": os.environ["PROFILE"],
    "region": os.environ["REGION"],
    "stack_name": os.environ["STACK_NAME"],
    "stack_parameters": {k: norm(v) for k, v in param_map.items()},
    "ecs": {
        "cluster": os.environ["CLUSTER"],
        "web_service": os.environ["WEB_SERVICE"],
        "worker_service": os.environ["WORKER_SERVICE"],
        "web_desired": int(os.environ["WEB_DESIRED"]),
        "worker_desired": int(os.environ["WORKER_DESIRED"]),
    },
}

path = os.path.abspath(os.environ["STATE_FILE"])
os.makedirs(os.path.dirname(path), exist_ok=True)
if os.path.exists(path):
    raise SystemExit(f"State file already exists: {path}")

with open(path, "w", encoding="utf-8") as f:
    json.dump(state, f, indent=2, sort_keys=True)

print(f"Wrote state: {path}")
PY

PARAM_ENV=$(python3 - <<'PY'
import json, os, shlex
params = json.loads(os.environ["STACK_PARAMS_JSON"])
param_map = {p.get("ParameterKey"): p.get("ParameterValue", "") for p in params}

def norm(v):
    if v is None:
        return ""
    if isinstance(v, str) and v.strip() == "None":
        return ""
    return v

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
]

for key in keys:
    value = norm(param_map.get(key, ""))
    print(f"{key}={shlex.quote(str(value))}")
PY
)

# shellcheck disable=SC1090
source <(printf '%s\n' "$PARAM_ENV")

args=("--stack-name" "$STACK_NAME")
if [[ -n "${VpcId:-}" ]]; then args+=("--vpc-id" "$VpcId"); fi
if [[ -n "${PublicSubnets:-}" ]]; then args+=("--public-subnets" "$PublicSubnets"); fi
if [[ -n "${PrivateSubnets:-}" ]]; then args+=("--private-subnets" "$PrivateSubnets"); fi
if [[ -n "${ServiceSubnets:-}" ]]; then args+=("--service-subnets" "$ServiceSubnets"); fi
if [[ -n "${AssignPublicIp:-}" ]]; then args+=("--assign-public-ip" "$AssignPublicIp"); fi

export ENABLE_WORKER="${EnableWorker:-true}"
export ENABLE_OUTBOX_SCHEDULE="${EnableOutboxSchedule:-false}"
export WEB_IMAGE="${WebImage:-}"
export WORKER_IMAGE="${WorkerImage:-}"
export WEB_DESIRED_COUNT="${WebDesiredCount:-$WEB_DESIRED}"
export WORKER_DESIRED_COUNT="${WorkerDesiredCount:-$WORKER_DESIRED}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true"
  echo "Would run: scripts/deploy-cf.sh --with-alb false --pause --create-dns false ${args[*]}"
  exit 0
fi

"$ROOT_DIR/scripts/deploy-cf.sh" \
  --with-alb false \
  --pause \
  --create-dns false \
  "${args[@]}"

echo "Pause complete. ECS services scaled to 0 and ALB removed (if present)."
