#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("node", ["scripts/finance_ledger_hygiene.mjs", "--apply", "--create-index"]);
run("node", ["scripts/finance_operational_gate.mjs"], {
  FINANCE_CYCLES_STRICT: "1",
  FINANCE_REQUIRE_MIN_SCANNED: process.env.FINANCE_REQUIRE_MIN_SCANNED ?? "0",
  FINANCE_REQUIRE_STATUS_EVENT: process.env.FINANCE_REQUIRE_STATUS_EVENT ?? "0",
});
