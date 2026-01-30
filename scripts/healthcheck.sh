#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${1:-${BASE_URL:-}}
CRON_SECRET=${ORYA_CRON_SECRET:-}
PATH=${HEALTH_PATH:-/api/internal/health}

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: healthcheck.sh <base_url>" >&2
  exit 1
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "ORYA_CRON_SECRET is required" >&2
  exit 1
fi

curl -sf -H "x-orya-cron-secret: $CRON_SECRET" "${BASE_URL%/}$PATH" >/dev/null

echo "OK ${BASE_URL%/}$PATH"
