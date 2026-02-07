#!/usr/bin/env bash
set -euo pipefail

URL="${LIGHTHOUSE_URL:-https://orya.pt}"
OUTDIR="${LIGHTHOUSE_OUTDIR:-reports/lighthouse}"
mkdir -p "$OUTDIR"

# Requires Chrome/Chromium in CI runner.
# Example: npx lighthouse "$URL" --output json --output-path "$OUTDIR/report.json" --chrome-flags="--headless"

npx lighthouse "$URL" \
  --output json \
  --output-path "$OUTDIR/report.json" \
  --chrome-flags="--headless" || {
    echo "Lighthouse run failed" >&2
    exit 1
  }
