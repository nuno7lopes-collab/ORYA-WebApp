#!/usr/bin/env bash
set -euo pipefail

HOSTS_FILE=${HOSTS_FILE:-/etc/hosts}
IP=${LOCALHOST_IP:-127.0.0.1}
DRY_RUN=${DRY_RUN:-false}

HOSTS=(
  "admin.localhost"
  "app.localhost"
  "test.localhost"
)

echo "[dev-hosts] Target hosts file: ${HOSTS_FILE}"
echo "[dev-hosts] Local IP: ${IP}"

function ensure_host() {
  local host="$1"
  if grep -qE "^[[:space:]]*${IP}[[:space:]]+.*\\b${host}\\b" "${HOSTS_FILE}"; then
    echo "[dev-hosts] OK: ${host}"
    return
  fi
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dev-hosts] DRY_RUN: would add '${IP} ${host}'"
    return
  fi
  echo "[dev-hosts] ADD: ${host}"
  echo "${IP} ${host}" | sudo tee -a "${HOSTS_FILE}" >/dev/null
}

for host in "${HOSTS[@]}"; do
  ensure_host "${host}"
done

echo "[dev-hosts] Done."
