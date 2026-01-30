#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROFILE=${AWS_PROFILE:-codex}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}

SOURCE=${1:-/tmp/orya-prod-secrets.json}

ALLOW_PLACEHOLDERS_DEV=${ALLOW_PLACEHOLDERS_DEV:-true}
COPY_PROD_TO_DEV=${COPY_PROD_TO_DEV:-false}

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" \
  ALLOW_PLACEHOLDERS_DEV="$ALLOW_PLACEHOLDERS_DEV" COPY_PROD_TO_DEV="$COPY_PROD_TO_DEV" \
  "$SCRIPT_DIR/create-secrets-json.sh" "$SOURCE"

echo "\nSecrets in AWS (prod):"
aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" \
  --query "SecretList[?starts_with(Name,'orya/prod/')].Name" --output text

echo "\nSecrets in AWS (dev):"
aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" \
  --query "SecretList[?starts_with(Name,'orya/dev/')].Name" --output text
