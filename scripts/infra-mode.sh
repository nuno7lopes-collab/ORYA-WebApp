#!/usr/bin/env bash
set -euo pipefail

MODE=${1:-}

ROOT_DOMAIN=${ROOT_DOMAIN:-orya.pt}
APP_DOMAIN=${APP_DOMAIN:-$ROOT_DOMAIN}
ADMIN_DOMAIN=${ADMIN_DOMAIN:-admin.${ROOT_DOMAIN}}
WITH_ACM=${WITH_ACM:-false}
AUTO_ACM=${AUTO_ACM:-true}

function need() {
  local key="$1"
  local desc="$2"
  if [[ -z "${!key:-}" ]]; then
    echo "[infra-mode] Missing ${key}. ${desc}" >&2
    exit 1
  fi
}

function ensure_alb_cert() {
  if [[ -n "${ALB_CERT_ARN:-}" ]]; then
    local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}"
    local cert_domain
    cert_domain=$(aws acm describe-certificate --region "$region" --certificate-arn "$ALB_CERT_ARN" --query "Certificate.DomainName" --output text 2>/dev/null || true)
    local cert_sans
    cert_sans=$(aws acm describe-certificate --region "$region" --certificate-arn "$ALB_CERT_ARN" --query "Certificate.SubjectAlternativeNames" --output text 2>/dev/null || true)
    if [[ -z "$cert_domain" ]]; then
      echo "[infra-mode] Unable to read ACM cert $ALB_CERT_ARN. Check permissions/region." >&2
      exit 1
    fi
    local domain="$APP_DOMAIN"
    local match=false
    for item in "$cert_domain" $cert_sans; do
      if [[ "$item" == "$domain" ]]; then
        match=true
        break
      fi
      if [[ "$item" == \*.* ]]; then
        local base="${item#*.}"
        if [[ "$domain" == *".${base}" ]]; then
          match=true
          break
        fi
      fi
    done
    if [[ "$match" != "true" ]]; then
      echo "[infra-mode] ACM cert does not cover ${domain}. Provide a cert that includes it (wildcard does not cover apex)." >&2
      exit 1
    fi
    return
  fi
  if [[ "${AUTO_ACM:-false}" == "true" ]]; then
    WITH_ACM=true
  fi
  if [[ "${WITH_ACM:-false}" == "true" ]]; then
    if [[ -z "${HOSTED_ZONE_ID:-}" ]]; then
      HOSTED_ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${ROOT_DOMAIN}.'].Id | [0]" --output text 2>/dev/null | sed 's|/hostedzone/||')
    fi
    need HOSTED_ZONE_ID "Required to create ACM cert via Route53."
    need ROOT_DOMAIN "Root domain (e.g. orya.pt)."
    need APP_DOMAIN "App domain (e.g. orya.pt)."
    need ADMIN_DOMAIN "Admin domain (e.g. admin.orya.pt)."
    return
  fi
  echo "[infra-mode] ALB requires a certificate. Set ALB_CERT_ARN or WITH_ACM=true + HOSTED_ZONE_ID/ROOT_DOMAIN/APP_DOMAIN/ADMIN_DOMAIN." >&2
  exit 1
}

function ensure_dns() {
  if [[ -z "${HOSTED_ZONE_ID:-}" ]]; then
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${ROOT_DOMAIN}.'].Id | [0]" --output text 2>/dev/null | sed 's|/hostedzone/||')
  fi
  need HOSTED_ZONE_ID "Required to create Route53 records."
  need APP_DOMAIN "Required to create app record."
  need ADMIN_DOMAIN "Required to create admin record."
  CREATE_DNS_RECORDS=true
}

function acm_args() {
  if [[ "${WITH_ACM:-false}" == "true" ]]; then
    echo "--with-acm true"
  else
    echo ""
  fi
}
function usage() {
  echo "Usage: infra-mode.sh local|public-min|public-on" >&2
}

case "$MODE" in
  local)
    DEV_ALL_NEXT_SCRIPT="${DEV_ALL_NEXT_SCRIPT:-dev:fast}" \
      DEV_ALL_CRON_MAX_CONCURRENCY="${DEV_ALL_CRON_MAX_CONCURRENCY:-1}" \
      DEV_ALL_SKIP_OPERATIONS_CRON="${DEV_ALL_SKIP_OPERATIONS_CRON:-1}" \
      npm run dev:all
    ;;
  public-min)
    ensure_alb_cert
    ensure_dns
    FORCE_PUBLIC_SUBNETS=true WITH_ALB=true ENABLE_WORKER=false \
      HOSTED_ZONE_ID="$HOSTED_ZONE_ID" APP_DOMAIN="$APP_DOMAIN" ADMIN_DOMAIN="$ADMIN_DOMAIN" CREATE_DNS_RECORDS="$CREATE_DNS_RECORDS" \
      ROOT_DOMAIN="$ROOT_DOMAIN" WITH_ACM="$WITH_ACM" \
      WEB_DESIRED_COUNT=1 WORKER_DESIRED_COUNT=0 \
      scripts/deploy-cf.sh --resume --force-public $(acm_args)
    ;;
  public-on)
    ensure_alb_cert
    ensure_dns
    FORCE_PUBLIC_SUBNETS=true WITH_ALB=true ENABLE_WORKER=true \
      HOSTED_ZONE_ID="$HOSTED_ZONE_ID" APP_DOMAIN="$APP_DOMAIN" ADMIN_DOMAIN="$ADMIN_DOMAIN" CREATE_DNS_RECORDS="$CREATE_DNS_RECORDS" \
      ROOT_DOMAIN="$ROOT_DOMAIN" WITH_ACM="$WITH_ACM" \
      WEB_DESIRED_COUNT=1 WORKER_DESIRED_COUNT=1 \
      scripts/deploy-cf.sh --resume --force-public $(acm_args)
    ;;
  *)
    usage
    exit 1
    ;;
esac
