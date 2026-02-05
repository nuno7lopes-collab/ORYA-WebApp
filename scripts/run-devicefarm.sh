#!/usr/bin/env bash
set -euo pipefail

# Device Farm / BrowserStack execution.
# AWS Device Farm requires PROJECT_ARN + DEVICE_POOL_ARN + app/test uploads.
# BrowserStack requires BROWSERSTACK_USERNAME/BROWSERSTACK_ACCESS_KEY and CLI.

PROVIDER="${DEVICE_FARM_PROVIDER:-aws}"
REGION="${AWS_REGION:-eu-west-1}"
RUN_NAME="${DEVICE_FARM_RUN_NAME:-orya-p1}"

log() {
  printf "[run-devicefarm] %s\n" "$*" 1>&2
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    log "Missing env: ${name}"
    exit 1
  fi
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
    import json as _json
    print(_json.dumps(cur))
else:
    print(cur)
PY
}

create_upload() {
  local name="$1"
  local type="$2"
  local path="$3"
  local project_arn="$4"
  local response
  response="$(aws devicefarm create-upload --project-arn "$project_arn" --name "$name" --type "$type" --region "$REGION")"
  local arn url
  arn="$(printf "%s" "$response" | json_field upload.arn)"
  url="$(printf "%s" "$response" | json_field upload.url)"
  if [[ -z "$arn" || -z "$url" ]]; then
    log "Failed to create upload for ${name}"
    echo "$response"
    exit 1
  fi
  log "Uploading ${name}..."
  curl -sS -T "$path" "$url" >/dev/null
  log "Waiting for upload ${arn}..."
  for _ in {1..40}; do
    local status
    status="$(aws devicefarm get-upload --arn "$arn" --region "$REGION" | json_field upload.status)"
    if [[ "$status" == "SUCCEEDED" ]]; then
      echo "$arn"
      return 0
    fi
    if [[ "$status" == "FAILED" ]]; then
      log "Upload failed for ${name}"
      exit 1
    fi
    sleep 5
  done
  log "Upload timeout for ${name}"
  exit 1
}

if [[ "$PROVIDER" == "aws" ]]; then
  require_env PROJECT_ARN
  require_env DEVICE_POOL_ARN

  APP_ARN="${APP_ARN:-}"
  TEST_PACKAGE_ARN="${TEST_PACKAGE_ARN:-}"
  TEST_SPEC_ARN="${TEST_SPEC_ARN:-}"
  APP_PATH="${APP_PATH:-}"
  TEST_PACKAGE_PATH="${TEST_PACKAGE_PATH:-}"
  TEST_SPEC_PATH="${TEST_SPEC_PATH:-}"
  TEST_TYPE="${TEST_TYPE:-APPIUM_NODE}"

  if [[ -z "$APP_ARN" ]]; then
    require_env APP_PATH
    APP_ARN="$(create_upload "$(basename "$APP_PATH")" "ANDROID_APP" "$APP_PATH" "$PROJECT_ARN")"
  fi

  if [[ -z "$TEST_PACKAGE_ARN" ]]; then
    require_env TEST_PACKAGE_PATH
    TEST_PACKAGE_ARN="$(create_upload "$(basename "$TEST_PACKAGE_PATH")" "APPIUM_NODE_TEST_PACKAGE" "$TEST_PACKAGE_PATH" "$PROJECT_ARN")"
  fi

  if [[ -n "$TEST_SPEC_PATH" && -z "$TEST_SPEC_ARN" ]]; then
    TEST_SPEC_ARN="$(create_upload "$(basename "$TEST_SPEC_PATH")" "APPIUM_NODE_TEST_SPEC" "$TEST_SPEC_PATH" "$PROJECT_ARN")"
  fi

  if [[ -n "$TEST_SPEC_ARN" ]]; then
    aws devicefarm schedule-run \
      --project-arn "$PROJECT_ARN" \
      --app-arn "$APP_ARN" \
      --device-pool-arn "$DEVICE_POOL_ARN" \
      --name "$RUN_NAME" \
      --test "type=${TEST_TYPE},testPackageArn=${TEST_PACKAGE_ARN},testSpecArn=${TEST_SPEC_ARN}" \
      --region "$REGION"
  else
    aws devicefarm schedule-run \
      --project-arn "$PROJECT_ARN" \
      --app-arn "$APP_ARN" \
      --device-pool-arn "$DEVICE_POOL_ARN" \
      --name "$RUN_NAME" \
      --test "type=${TEST_TYPE},testPackageArn=${TEST_PACKAGE_ARN}" \
      --region "$REGION"
  fi
elif [[ "$PROVIDER" == "browserstack" ]]; then
  require_env BROWSERSTACK_USERNAME
  require_env BROWSERSTACK_ACCESS_KEY
  require_env BROWSERSTACK_APP
  require_env BROWSERSTACK_TEST_SUITE

  if ! command -v browserstack >/dev/null 2>&1; then
    log "BrowserStack CLI not found (install: npm i -g browserstack-cli)"
    exit 1
  fi

  browserstack --version
  browserstack config set-credentials --username "$BROWSERSTACK_USERNAME" --access-key "$BROWSERSTACK_ACCESS_KEY"
  browserstack build run \
    --app "$BROWSERSTACK_APP" \
    --test-suite "$BROWSERSTACK_TEST_SUITE" \
    --project-name "ORYA" \
    --build-name "$RUN_NAME"
else
  log "Unknown provider: $PROVIDER"
  exit 1
fi
