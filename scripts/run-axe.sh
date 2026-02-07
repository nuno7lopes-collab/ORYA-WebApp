#!/usr/bin/env bash
set -euo pipefail

URL="${AXE_URL:-https://orya.pt}"
OUTDIR="${AXE_OUTDIR:-reports/axe}"
mkdir -p "$OUTDIR"

# Requires @axe-core/cli
# Example: npx @axe-core/cli "$URL" --save "$OUTDIR/report.json"

npx @axe-core/cli "$URL" --save "$OUTDIR/report.json" || {
  echo "axe run failed" >&2
  exit 1
}
