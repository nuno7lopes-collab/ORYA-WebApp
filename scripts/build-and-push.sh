#!/usr/bin/env bash
set -euo pipefail

REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-codex}
ACCOUNT_ID=${AWS_ACCOUNT_ID:-""}
WEB_REPO=${WEB_REPO:-orya-web}
WORKER_REPO=${WORKER_REPO:-orya-worker}
SHA=${GIT_SHA:-$(git rev-parse --short=12 HEAD)}
TARGET=all

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)
      REGION="$2"; shift 2;;
    --profile)
      PROFILE="$2"; shift 2;;
    --ecr-repo)
      if [[ "$2" == *worker* ]]; then
        WORKER_REPO="$2"
        TARGET=worker
      else
        WEB_REPO="$2"
        TARGET=web
      fi
      shift 2;;
    --web-repo)
      WEB_REPO="$2"; TARGET=web; shift 2;;
    --worker-repo)
      WORKER_REPO="$2"; TARGET=worker; shift 2;;
    --target)
      TARGET="$2"; shift 2;;
    *)
      echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
fi

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

function ensure_repo() {
  local name="$1"
  if ! aws ecr describe-repositories --profile "$PROFILE" --region "$REGION" --repository-names "$name" >/dev/null 2>&1; then
    aws ecr create-repository --profile "$PROFILE" --region "$REGION" --repository-name "$name" >/dev/null
  fi
  aws ecr put-lifecycle-policy --profile "$PROFILE" --region "$REGION" --repository-name "$name" \
    --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 5 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}' >/dev/null
}

if [[ "$TARGET" == "all" || "$TARGET" == "web" ]]; then
  ensure_repo "$WEB_REPO"
fi
if [[ "$TARGET" == "all" || "$TARGET" == "worker" ]]; then
  ensure_repo "$WORKER_REPO"
fi

aws ecr get-login-password --profile "$PROFILE" --region "$REGION" | \
  docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

WEB_IMAGE_SHA="$REGISTRY/$WEB_REPO:$SHA"
WEB_IMAGE_LATEST="$REGISTRY/$WEB_REPO:latest"
WORKER_IMAGE_SHA="$REGISTRY/$WORKER_REPO:$SHA"
WORKER_IMAGE_LATEST="$REGISTRY/$WORKER_REPO:latest"

if [[ "$TARGET" == "all" || "$TARGET" == "web" ]]; then
  if [[ ! -f Dockerfile.web ]]; then
    echo "Missing Dockerfile.web" >&2
    exit 1
  fi
  docker build -f Dockerfile.web -t "$WEB_IMAGE_SHA" -t "$WEB_IMAGE_LATEST" .
  docker push "$WEB_IMAGE_SHA"
  docker push "$WEB_IMAGE_LATEST"
  echo "WEB_IMAGE_SHA=$WEB_IMAGE_SHA"
fi

if [[ "$TARGET" == "all" || "$TARGET" == "worker" ]]; then
  docker build -f Dockerfile.worker -t "$WORKER_IMAGE_SHA" -t "$WORKER_IMAGE_LATEST" .
  docker push "$WORKER_IMAGE_SHA"
  docker push "$WORKER_IMAGE_LATEST"
  echo "WORKER_IMAGE_SHA=$WORKER_IMAGE_SHA"
fi
