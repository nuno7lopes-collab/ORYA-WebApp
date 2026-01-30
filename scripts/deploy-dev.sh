#!/usr/bin/env bash
set -euo pipefail

REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-codex}
STACK_NAME=${STACK_NAME:-orya-dev}
TEMPLATE=${TEMPLATE:-infra/dev/template.yaml}
ENV_NAME=${ENV_NAME:-dev}
IMAGE_URI=${IMAGE_URI:-""}

if [[ -z "$IMAGE_URI" ]]; then
  echo "IMAGE_URI is required (ECR image for Lambda)." >&2
  exit 1
fi

aws cloudformation deploy --profile "$PROFILE" --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName="$ENV_NAME" \
    ImageUri="$IMAGE_URI" \
    SecretsPrefix="orya/dev"

echo "STACK=$STACK_NAME"
echo "HTTP_API_URL=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" --output text)"
