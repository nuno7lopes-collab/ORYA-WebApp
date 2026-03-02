#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-codex}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ORYA_SECRETS_ENV="${ORYA_SECRETS_ENV:-prod}"
ORYA_SECRETS_GROUPS="${ORYA_SECRETS_GROUPS:-app,supabase,payments,apple,email,admin}"
ENV_FILE="${ENV_FILE:-.env.local}"
RUN_DEV="${RUN_DEV:-0}"
NEXT_HOST="${NEXT_HOST:-0.0.0.0}"
NEXT_PORT="${NEXT_PORT:-3000}"
FORCE_NPM_CI="${FORCE_NPM_CI:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v aws >/dev/null 2>&1; then
  echo "[codespace] aws CLI em falta."
  echo "[codespace] instala o aws-cli ou usa um Codespace com aws-cli pre-instalado."
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "[codespace] AWS sem autenticacao."
  echo "[codespace] faz login com: aws sso login --profile ${AWS_PROFILE}"
  echo "[codespace] ou define secrets do Codespaces (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN)."
  exit 1
fi

export AWS_PROFILE AWS_REGION ORYA_SECRETS_ENV ORYA_SECRETS_GROUPS ENV_FILE

python3 - <<'PY'
import json
import os
import subprocess
import sys

secret_env = os.environ["ORYA_SECRETS_ENV"].strip()
groups = [g.strip() for g in os.environ["ORYA_SECRETS_GROUPS"].split(",") if g.strip()]
env_file = os.environ["ENV_FILE"]

merged = {}
errors = []

for group in groups:
    secret_id = f"orya/{secret_env}/{group}"
    try:
        raw = subprocess.check_output(
            [
                "aws",
                "secretsmanager",
                "get-secret-value",
                "--secret-id",
                secret_id,
                "--query",
                "SecretString",
                "--output",
                "text",
            ],
            text=True,
            stderr=subprocess.STDOUT,
        ).strip()
    except subprocess.CalledProcessError as exc:
        msg = exc.output.strip() if isinstance(exc.output, str) else str(exc)
        errors.append(f"{secret_id}: {msg}")
        continue

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        errors.append(f"{secret_id}: SecretString nao esta em JSON valido.")
        continue

    if isinstance(payload, dict):
        merged.update(payload)

if errors:
    print("[codespace] falha ao obter segredos:")
    for error in errors:
        print(f" - {error}")
    sys.exit(1)

lines = []
for key in sorted(merged.keys()):
    value = merged.get(key)
    if not isinstance(value, str):
        continue
    value = value.strip()
    if not value or value.startswith("REPLACE_ME_"):
        continue
    safe = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    lines.append(f'{key}="{safe}"')

with open(env_file, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
    if lines:
        f.write("\n")

print(f"[codespace] {env_file} criado com {len(lines)} variaveis.")
PY

if [[ "$FORCE_NPM_CI" == "1" || ! -d node_modules ]]; then
  echo "[codespace] a instalar dependencias (npm ci)..."
  npm ci
else
  echo "[codespace] node_modules ja existe; a saltar npm ci."
fi

if [[ "$RUN_DEV" == "1" ]]; then
  echo "[codespace] a arrancar dev server..."
  exec npm run dev -- --hostname "$NEXT_HOST" --port "$NEXT_PORT"
fi

echo "[codespace] pronto."
echo "[codespace] usa: npm run dev -- --hostname ${NEXT_HOST} --port ${NEXT_PORT}"
