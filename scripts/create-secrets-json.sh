#!/usr/bin/env bash
set -euo pipefail

SRC_FILE=${1:-/tmp/orya-prod-secrets.json}
OUT_DIR=${OUT_DIR:-/tmp/orya-secrets}
FLAT_TEMPLATE=${FLAT_TEMPLATE:-/tmp/orya-prod-secrets.flat.json}
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}
PROFILE=${AWS_PROFILE:-codex}
COPY_PROD_TO_DEV=${COPY_PROD_TO_DEV:-false}
ALLOW_PLACEHOLDERS_DEV=${ALLOW_PLACEHOLDERS_DEV:-true}
NO_UPLOAD=${NO_UPLOAD:-false}
ONLY_GROUPS=${ONLY_GROUPS:-}
ONLY_ENVS=${ONLY_ENVS:-}
FORCE_PLACEHOLDERS_PROD=${FORCE_PLACEHOLDERS_PROD:-false}

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

SRC_FILE="$SRC_FILE" \
OUT_DIR="$OUT_DIR" \
FLAT_TEMPLATE="$FLAT_TEMPLATE" \
COPY_PROD_TO_DEV="$COPY_PROD_TO_DEV" \
ALLOW_PLACEHOLDERS_DEV="$ALLOW_PLACEHOLDERS_DEV" \
FORCE_PLACEHOLDERS_PROD="$FORCE_PLACEHOLDERS_PROD" \
python3 - <<'PY'
import json
import os
import re
from pathlib import Path

src_file = Path(os.environ.get("SRC_FILE", "/tmp/orya-prod-secrets.json"))
out_dir = Path(os.environ.get("OUT_DIR", "/tmp/orya-secrets"))
flat_template = Path(os.environ.get("FLAT_TEMPLATE", "/tmp/orya-prod-secrets.flat.json"))
copy_prod_to_dev = os.environ.get("COPY_PROD_TO_DEV", "false").lower() == "true"
allow_placeholders_dev = os.environ.get("ALLOW_PLACEHOLDERS_DEV", "true").lower() == "true"
force_placeholders_prod = os.environ.get("FORCE_PLACEHOLDERS_PROD", "false").lower() == "true"

with src_file.open("r", encoding="utf-8") as f:
    data = json.load(f)

paths = []


def walk(prefix, value):
    if isinstance(value, dict):
        for k, v in value.items():
            walk(f"{prefix}/{k}" if prefix else k, v)
    else:
        paths.append((prefix, value))


walk("", data)

value_by_key = {}
missing_keys = set()

for path, value in paths:
    if "orya/prod/" not in path:
        continue
    idx = path.find("orya/prod/")
    secret_path = path[idx:]
    env_key = secret_path.split("/")[-1]
    if env_key in value_by_key:
        # Keep first non-empty value
        continue
    if value is None:
        missing_keys.add(env_key)
        continue
    if isinstance(value, str):
        if not value.strip():
            missing_keys.add(env_key)
            continue
        if value.strip().startswith("REPLACE_ME"):
            missing_keys.add(env_key)
            continue
        value_by_key[env_key] = value
        continue
    # Fallback for non-string values
    value_by_key[env_key] = str(value)

SUPABASE_KEYS = {
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
}

PAYMENT_KEYS = {
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
}

APPLE_KEYS = {
    "APPLE_SIGNIN_KEY_ID",
    "APPLE_SIGNIN_PRIVATE_KEY_BASE64",
    "APPLE_SIGNIN_REDIRECT_URI",
    "APPLE_SIGNIN_SERVICE_ID",
    "APPLE_SIGNIN_TEAM_ID",
    "APPLE_PAY_CERTIFICATE_BASE64",
    "APPLE_PAY_DOMAIN_VERIFICATION_FILE",
    "APPLE_PAY_MERCHANT_ID",
    "APNS_KEY_ID",
    "APNS_PRIVATE_KEY_BASE64",
    "APNS_TEAM_ID",
    "APNS_TOPIC",
}

EMAIL_KEYS = {
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SES_IDENTITY_DOMAIN",
    "SES_REGION",
    "SES_SMTP_USERNAME",
    "SES_SMTP_PASSWORD",
}

ADMIN_KEYS = {
    "STAGING_ADMIN_EMAIL",
    "STAGING_ADMIN_PASSWORD",
    "STAGING_ADMIN_SESSION",
    "DEVICE_FARM_PROVIDER",
    "DEVICE_FARM_USER",
    "DEVICE_FARM_KEY",
}


def group_for(key: str) -> str:
    if key in SUPABASE_KEYS:
        return "supabase"
    if key in PAYMENT_KEYS:
        return "payments"
    if key in APPLE_KEYS:
        return "apple"
    if key in EMAIL_KEYS:
        return "email"
    if key in ADMIN_KEYS:
        return "admin"
    return "app"


all_keys = sorted(set(value_by_key.keys()) | missing_keys)

# Flat template with placeholders
flat = {key: f"REPLACE_ME_{key}" for key in all_keys}
flat_template.write_text(json.dumps(flat, indent=2, ensure_ascii=True), encoding="utf-8")

prod_groups = {"app": {}, "supabase": {}, "payments": {}, "apple": {}, "email": {}, "admin": {}}
for key, value in value_by_key.items():
    prod_groups[group_for(key)][key] = value

# Optionally inject placeholders for missing keys in prod (apple/aasa)
if force_placeholders_prod and missing_keys:
    for key in sorted(missing_keys):
        prod_groups[group_for(key)].setdefault(key, f"REPLACE_ME_{key}")

# Dev groups
if copy_prod_to_dev:
    dev_groups = json.loads(json.dumps(prod_groups))
else:
    dev_groups = {"app": {}, "supabase": {}, "payments": {}, "apple": {}, "email": {}, "admin": {}}
    for key in all_keys:
        if allow_placeholders_dev:
            dev_groups[group_for(key)][key] = f"REPLACE_ME_{key}"

out_dir.mkdir(parents=True, exist_ok=True)

def write_groups(prefix: str, groups: dict):
    for group, payload in groups.items():
        path = out_dir / f"{prefix}-{group}.json"
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")

write_groups("orya-prod", prod_groups)
write_groups("orya-dev", dev_groups)

print(f"Wrote flat template: {flat_template}")
print(f"Wrote grouped secrets in: {out_dir}")
PY

if [[ "$NO_UPLOAD" == "true" ]]; then
  exit 0
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found" >&2
  exit 1
fi

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

function group_allowed() {
  local name="$1"
  if [[ -z "$ONLY_GROUPS" ]]; then
    return 0
  fi
  IFS=',' read -ra groups <<< "$ONLY_GROUPS"
  for g in "${groups[@]}"; do
    if [[ "$g" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

function env_allowed() {
  local name="$1"
  if [[ -z "$ONLY_ENVS" ]]; then
    return 0
  fi
  IFS=',' read -ra envs <<< "$ONLY_ENVS"
  for e in "${envs[@]}"; do
    if [[ "$e" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

for env in prod dev; do
  if ! env_allowed "$env"; then
    continue
  fi
  for group in app supabase payments apple email admin; do
    if ! group_allowed "$group"; then
      continue
    fi
    file="$OUT_DIR/orya-${env}-${group}.json"
    if [[ ! -f "$file" ]]; then
      echo "Missing group file: $file" >&2
      exit 1
    fi
    upsert_secret "orya/${env}/${group}" "$file" "ORYA ${env} ${group} secrets"
  done
done
