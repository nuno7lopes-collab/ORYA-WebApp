#!/usr/bin/env bash
set -euo pipefail

# Skeleton for Device Farm / BrowserStack execution.
# Requires AWS Device Farm project or BrowserStack credentials.

PROVIDER="${DEVICE_FARM_PROVIDER:-aws}"
REGION="${AWS_REGION:-eu-west-1}"

if [[ "$PROVIDER" == "aws" ]]; then
  echo "Starting AWS Device Farm run (skeleton)"
  echo "TODO: create-upload, upload test package, schedule run"
  echo "Example commands:"
  cat <<'EOF'
# PROJECT_ARN=arn:aws:devicefarm:...
# APP_ARN=arn:aws:devicefarm:... (uploaded app or web test package)
# TEST_SPEC_ARN=arn:aws:devicefarm:... (test spec)
# aws devicefarm schedule-run --project-arn "$PROJECT_ARN" --app-arn "$APP_ARN" --device-pool-arn "$POOL_ARN" --name "orya-p1" --test type=APPIUM_NODE,testSpecArn=$TEST_SPEC_ARN
EOF
elif [[ "$PROVIDER" == "browserstack" ]]; then
  echo "Starting BrowserStack run (skeleton)"
  echo "TODO: invoke BrowserStack CLI with credentials"
else
  echo "Unknown provider: $PROVIDER"
  exit 1
fi
