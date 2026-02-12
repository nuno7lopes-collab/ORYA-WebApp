# AWS

```bash
# PAUSE TOTAL (ECS + ALB + REDIS)
set -euo pipefail

PROFILE="${AWS_PROFILE:-codex}"
REGION="${AWS_REGION:-eu-west-1}"
STACK_NAME="${STACK_NAME:-orya-prod}"
REDIS_SECRET_ID="${REDIS_SECRET_ID:-orya/prod/app}"
STATE_DIR="scripts/aws/state"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
CF_STATE="${STATE_DIR}/${STACK_NAME}-pause-${TIMESTAMP}.json"
REDIS_STATE="${STATE_DIR}/${STACK_NAME}-redis-pause-${TIMESTAMP}.json"
PAUSE_REF="${STATE_DIR}/${STACK_NAME}-last-pause.env"
RESUME_REDIS_MODE="skip"

mkdir -p "$STATE_DIR"

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" STACK_NAME="$STACK_NAME" STATE_FILE="$CF_STATE" \
  bash scripts/aws/pause-prod.sh

REDIS_URL="$(aws --profile "$PROFILE" --region "$REGION" secretsmanager get-secret-value \
  --secret-id "$REDIS_SECRET_ID" --query 'SecretString' --output text \
  | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("REDIS_URL",""))')"

REDIS_CACHE_NAME="$(python3 - <<'PY' "$REDIS_URL"
import sys
from urllib.parse import urlparse
raw = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
if not raw:
    print("")
    raise SystemExit(0)
host = urlparse(raw).hostname or ""
print(host.split(".")[0] if host else "")
PY
)"

if [ -n "$REDIS_CACHE_NAME" ]; then
  CACHE_JSON="$(aws --profile "$PROFILE" --region "$REGION" elasticache describe-serverless-caches \
    --serverless-cache-name "$REDIS_CACHE_NAME" \
    --query 'ServerlessCaches[0]' --output json 2>/dev/null || true)"

  if [ -n "$CACHE_JSON" ] && [ "$CACHE_JSON" != "null" ] && [ "$CACHE_JSON" != "None" ]; then
    python3 - <<'PY' "$REDIS_STATE" "$PROFILE" "$REGION" "$REDIS_SECRET_ID" "$REDIS_URL" "$CACHE_JSON"
import datetime
import json
import sys

path, profile, region, secret_id, redis_url, cache_json = sys.argv[1:]
state = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "profile": profile,
    "region": region,
    "secret_id": secret_id,
    "redis_url_before": redis_url,
    "serverless_cache": json.loads(cache_json),
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(state, f, indent=2, sort_keys=True)
print(path)
PY

    RESUME_REDIS_MODE="require"
    aws --profile "$PROFILE" --region "$REGION" elasticache delete-serverless-cache \
      --serverless-cache-name "$REDIS_CACHE_NAME" >/dev/null

    until ! aws --profile "$PROFILE" --region "$REGION" elasticache describe-serverless-caches \
      --serverless-cache-name "$REDIS_CACHE_NAME" >/dev/null 2>&1; do
      sleep 5
    done
  fi
fi

if [ "$RESUME_REDIS_MODE" = "skip" ]; then
  LATEST_REDIS_STATE="$(find "$STATE_DIR" -maxdepth 1 -type f -name "${STACK_NAME}-redis-pause-*.json" | sort | tail -n 1)"
  if [ -n "$LATEST_REDIS_STATE" ]; then
    REDIS_STATE="$LATEST_REDIS_STATE"
    RESUME_REDIS_MODE="require"
  fi
fi

cat > "$PAUSE_REF" <<EOF
STATE_FILE=$CF_STATE
REDIS_STATE_FILE=$REDIS_STATE
AWS_PROFILE=$PROFILE
AWS_REGION=$REGION
STACK_NAME=$STACK_NAME
REDIS_SECRET_ID=$REDIS_SECRET_ID
RESUME_REDIS_MODE=$RESUME_REDIS_MODE
EOF

echo "PAUSED: $PAUSE_REF"
```

```bash
# RESUME COMPLETO (RECRIA REDIS + ATUALIZA SECRET + SOBE ECS/ALB)
set -euo pipefail

PAUSE_REF="${PAUSE_REF:-scripts/aws/state/orya-prod-last-pause.env}"
[ -f "$PAUSE_REF" ] || { echo "Ficheiro não encontrado: $PAUSE_REF"; exit 1; }

set -a
. "$PAUSE_REF"
set +a

AWS_PROFILE="$AWS_PROFILE" \
AWS_REGION="$AWS_REGION" \
STACK_NAME="$STACK_NAME" \
STATE_FILE="$STATE_FILE" \
REDIS_STATE_FILE="$REDIS_STATE_FILE" \
REDIS_SECRET_ID="$REDIS_SECRET_ID" \
RESUME_REDIS_MODE="$RESUME_REDIS_MODE" \
bash scripts/aws/start-prod.sh
```
