#!/usr/bin/env bash
set -euo pipefail

REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-codex}
STACK_NAME=${STACK_NAME:-orya-prod}
ACM_STACK_NAME=${ACM_STACK_NAME:-orya-route53-acm}
TEMPLATE=${TEMPLATE:-infra/ecs/orya-ecs-stack.yaml}
ACM_TEMPLATE=${ACM_TEMPLATE:-infra/ecs/route53-acm.yaml}
ENV_NAME=${ENV_NAME:-prod}
WITH_ALB=${WITH_ALB:-false}
WITH_ACM=${WITH_ACM:-false}
ENABLE_WORKER=${ENABLE_WORKER:-false}
PAUSE=false
RESUME=false
HARD_PAUSE=false

WEB_DESIRED_COUNT=${WEB_DESIRED_COUNT:-1}
WORKER_DESIRED_COUNT=${WORKER_DESIRED_COUNT:-0}

function usage() {
  echo "Usage: deploy-cf.sh [--with-alb true|false] [--with-acm true|false] [--pause|--resume|--hard-pause]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-alb)
      WITH_ALB="$2"; shift 2;;
    --with-acm)
      WITH_ACM="$2"; shift 2;;
    --pause)
      PAUSE=true; shift;;
    --resume)
      RESUME=true; shift;;
    --hard-pause)
      HARD_PAUSE=true; shift;;
    --stack-name)
      STACK_NAME="$2"; shift 2;;
    --vpc-id)
      VPC_ID="$2"; shift 2;;
    --public-subnets)
      PUBLIC_SUBNETS="$2"; shift 2;;
    --private-subnets)
      PRIVATE_SUBNETS="$2"; shift 2;;
    --service-subnets)
      SERVICE_SUBNETS="$2"; shift 2;;
    --assign-public-ip)
      ASSIGN_PUBLIC_IP="$2"; shift 2;;
    --alb-cert-arn)
      ALB_CERT_ARN="$2"; shift 2;;
    *)
      usage; exit 1;;
  esac
 done

if [[ "$HARD_PAUSE" == "true" ]]; then
  aws cloudformation delete-stack --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME"
  echo "Requested stack delete: $STACK_NAME"
  exit 0
fi

function pick_vpc() {
  if [[ -n "${VPC_ID:-}" ]]; then
    echo "$VPC_ID"
    return
  fi
  local vpc
  vpc=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" --query "Vpcs[?IsDefault==\`true\`].VpcId | [0]" --output text)
  if [[ "$vpc" == "None" || -z "$vpc" ]]; then
    vpc=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" --query "Vpcs[0].VpcId" --output text)
  fi
  if [[ -z "$vpc" || "$vpc" == "None" ]]; then
    echo "Unable to discover VPC" >&2
    exit 1
  fi
  echo "$vpc"
}

function distinct_subnets() {
  local want_public="$1"
  local vpc_id="$2"
  local subnets
  subnets=$(aws ec2 describe-subnets --profile "$PROFILE" --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query "Subnets[?MapPublicIpOnLaunch==\`${want_public}\`].[SubnetId,AvailabilityZone]" \
    --output text)
  if [[ -z "$subnets" ]]; then
    return 1
  fi
  local chosen=()
  local seen_az=()
  while read -r subnet az; do
    if [[ -z "$subnet" || -z "$az" ]]; then
      continue
    fi
    if [[ " ${seen_az[*]-} " == *" $az "* ]]; then
      continue
    fi
    chosen+=("$subnet")
    seen_az+=("$az")
    if [[ ${#chosen[@]} -ge 2 ]]; then
      break
    fi
  done <<< "$subnets"
  if [[ ${#chosen[@]} -lt 2 ]]; then
    return 1
  fi
  IFS=","; echo "${chosen[*]}"; IFS=$' \t\n'
}

function has_nat() {
  local vpc_id="$1"
  local nat
  nat=$(aws ec2 describe-nat-gateways --profile "$PROFILE" --region "$REGION" \
    --filter "Name=vpc-id,Values=$vpc_id" "Name=state,Values=available" \
    --query "NatGateways[0].NatGatewayId" --output text)
  if [[ "$nat" == "None" || -z "$nat" ]]; then
    return 1
  fi
  return 0
}

VPC_ID=$(pick_vpc)

if [[ -z "${PUBLIC_SUBNETS:-}" || -z "${PRIVATE_SUBNETS:-}" || -z "${SERVICE_SUBNETS:-}" ]]; then
  if has_nat "$VPC_ID"; then
    PRIVATE_SUBNETS=${PRIVATE_SUBNETS:-$(distinct_subnets false "$VPC_ID")}
  fi
  if [[ -z "${PRIVATE_SUBNETS:-}" ]]; then
    PUBLIC_SUBNETS=${PUBLIC_SUBNETS:-$(distinct_subnets true "$VPC_ID")}
    SERVICE_SUBNETS=${SERVICE_SUBNETS:-$PUBLIC_SUBNETS}
    ASSIGN_PUBLIC_IP=${ASSIGN_PUBLIC_IP:-ENABLED}
  else
    PUBLIC_SUBNETS=${PUBLIC_SUBNETS:-$(distinct_subnets true "$VPC_ID")}
    SERVICE_SUBNETS=${SERVICE_SUBNETS:-$PRIVATE_SUBNETS}
    ASSIGN_PUBLIC_IP=${ASSIGN_PUBLIC_IP:-DISABLED}
  fi
fi

if [[ -z "${PUBLIC_SUBNETS:-}" || -z "${SERVICE_SUBNETS:-}" ]]; then
  echo "Unable to discover subnets" >&2
  exit 1
fi

if [[ "$WITH_ACM" == "true" ]]; then
  if [[ -z "${HOSTED_ZONE_ID:-}" ]]; then
    echo "HOSTED_ZONE_ID is required for ACM stack" >&2
    exit 1
  fi
  ROOT_DOMAIN=${ROOT_DOMAIN:-orya.pt}
  APP_DOMAIN=${APP_DOMAIN:-app.orya.pt}
  ADMIN_DOMAIN=${ADMIN_DOMAIN:-admin.orya.pt}
  aws cloudformation deploy --profile "$PROFILE" --region "$REGION" \
    --stack-name "$ACM_STACK_NAME" \
    --template-file "$ACM_TEMPLATE" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides HostedZoneId="$HOSTED_ZONE_ID" RootDomain="$ROOT_DOMAIN" AppDomain="$APP_DOMAIN" AdminDomain="$ADMIN_DOMAIN"

  ALB_CERT_ARN=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" \
    --stack-name "$ACM_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CertificateArn'].OutputValue" --output text)
fi

if [[ "$WITH_ALB" == "true" && -z "${ALB_CERT_ARN:-}" ]]; then
  echo "ALB certificate ARN required (set ALB_CERT_ARN or --with-acm true)." >&2
  exit 1
fi

ACCOUNT_ID=${AWS_ACCOUNT_ID:-""}
if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
fi
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
WEB_IMAGE=${WEB_IMAGE:-$REGISTRY/orya-web:latest}
WORKER_IMAGE=${WORKER_IMAGE:-$REGISTRY/orya-worker:latest}

aws cloudformation deploy --profile "$PROFILE" --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName="$ENV_NAME" \
    VpcId="$VPC_ID" \
    PublicSubnets="$PUBLIC_SUBNETS" \
    PrivateSubnets="$SERVICE_SUBNETS" \
    ServiceSubnets="$SERVICE_SUBNETS" \
    AssignPublicIp="$ASSIGN_PUBLIC_IP" \
    WebImage="$WEB_IMAGE" \
    WorkerImage="$WORKER_IMAGE" \
    WebDesiredCount="$WEB_DESIRED_COUNT" \
    WorkerDesiredCount="$WORKER_DESIRED_COUNT" \
    CreateALB="$WITH_ALB" \
    EnableWorker="$ENABLE_WORKER" \
    AlbCertificateArn="${ALB_CERT_ARN:-}" \
    SecretsPrefix="orya/prod" \
    BudgetNotificationEmail="${BUDGET_NOTIFICATION_EMAIL:-}" \
    LogIngestThresholdBytes="${LOG_INGEST_THRESHOLD_BYTES:-50000000}"

if [[ "$PAUSE" == "true" || "$RESUME" == "true" ]]; then
  cluster=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" --output text)
  web_service=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='WebServiceName'].OutputValue" --output text)
  worker_service=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='WorkerServiceName'].OutputValue" --output text)

  if [[ "$PAUSE" == "true" ]]; then
    aws ecs update-service --profile "$PROFILE" --region "$REGION" --cluster "$cluster" --service "$web_service" --desired-count 0 >/dev/null
    if [[ "$worker_service" != "None" && -n "$worker_service" ]]; then
      aws ecs update-service --profile "$PROFILE" --region "$REGION" --cluster "$cluster" --service "$worker_service" --desired-count 0 >/dev/null
    fi
  fi

  if [[ "$RESUME" == "true" ]]; then
    aws ecs update-service --profile "$PROFILE" --region "$REGION" --cluster "$cluster" --service "$web_service" --desired-count "$WEB_DESIRED_COUNT" >/dev/null
    if [[ "$worker_service" != "None" && -n "$worker_service" ]]; then
      aws ecs update-service --profile "$PROFILE" --region "$REGION" --cluster "$cluster" --service "$worker_service" --desired-count "$WORKER_DESIRED_COUNT" >/dev/null
    fi
  fi
fi

cluster=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" --output text)
web_service=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='WebServiceName'].OutputValue" --output text)
aws ecs update-service --profile "$PROFILE" --region "$REGION" --cluster "$cluster" --service "$web_service" --force-new-deployment >/dev/null

echo "STACK=$STACK_NAME"
echo "VPC_ID=$VPC_ID"
echo "PUBLIC_SUBNETS=$PUBLIC_SUBNETS"
echo "SERVICE_SUBNETS=$SERVICE_SUBNETS"
if [[ "$WITH_ALB" == "true" ]]; then
  alb=$(aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" --output text)
  echo "ALB_DNS=$alb"
fi
