#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROFILE=${AWS_PROFILE:-codex}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
SOURCE=/tmp/orya-prod-secrets.json
SOURCE_DIR=""

ALLOW_PLACEHOLDERS_DEV=${ALLOW_PLACEHOLDERS_DEV:-true}
COPY_PROD_TO_DEV=${COPY_PROD_TO_DEV:-false}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="$2"; shift 2;;
    --region)
      REGION="$2"; shift 2;;
    --profile)
      PROFILE="$2"; shift 2;;
    --in)
      SOURCE="$2"; shift 2;;
    *)
      echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

function upsert_secret() {
  local name="$1"
  local file="$2"
  local description="$3"

  if aws secretsmanager describe-secret --profile "$PROFILE" --region "$REGION" --secret-id "$name" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --profile "$PROFILE" --region "$REGION" --secret-id "$name" --secret-string "file://$file" >/dev/null
    echo "UPDATED $name"
  else
    aws secretsmanager create-secret --profile "$PROFILE" --region "$REGION" --name "$name" --description "$description" --secret-string "file://$file" >/dev/null
    echo "CREATED $name"
  fi
}

if [[ -n "$SOURCE_DIR" ]]; then
  for env in prod dev; do
    for group in app supabase payments apple email admin; do
      file="$SOURCE_DIR/orya-${env}-${group}.json"
      if [[ ! -f "$file" ]]; then
        echo "Missing group file: $file" >&2
        exit 1
      fi
      upsert_secret "orya/${env}/${group}" "$file" "ORYA ${env} ${group} secrets"
    done
  done
else
  AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" \
    ALLOW_PLACEHOLDERS_DEV="$ALLOW_PLACEHOLDERS_DEV" COPY_PROD_TO_DEV="$COPY_PROD_TO_DEV" \
    "$SCRIPT_DIR/create-secrets-json.sh" --in "$SOURCE"
fi

echo "\nSecrets in AWS (prod):"
aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" \
  --query "SecretList[?starts_with(Name,'orya/prod/')].Name" --output text

echo "\nSecrets in AWS (dev):"
aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" \
  --query "SecretList[?starts_with(Name,'orya/dev/')].Name" --output text
