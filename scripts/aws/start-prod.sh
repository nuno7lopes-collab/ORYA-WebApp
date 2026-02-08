#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)

STATE_FILE=${STATE_FILE:-$ROOT_DIR/scripts/aws/state/orya-prod-pause.json}
DRY_RUN=${DRY_RUN:-false}

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

# shellcheck disable=SC1090
source <(printf '%s\n' "$EXPORTS")

PROFILE=${AWS_PROFILE:-${STATE_PROFILE:-codex}}
REGION=${AWS_REGION:-${STATE_REGION:-eu-west-1}}
STACK_NAME=${STACK_NAME:-${STATE_STACK_NAME:-orya-prod}}

function aws_cmd() {
  aws --profile "$PROFILE" --region "$REGION" "$@"
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
