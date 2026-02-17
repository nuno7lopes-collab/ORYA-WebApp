#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./load-env.js");

process.env.UI_E2E_BASE_URL =
  process.env.UI_E2E_BASE_URL ??
  process.env.ORYA_E2E_BASE_URL ??
  "http://127.0.0.1:33123";
process.env.UI_E2E_SEED_ORG_USERNAME = process.env.UI_E2E_SEED_ORG_USERNAME ?? "top_padel";
process.env.ALLOW_LOCAL_ADMIN = process.env.ALLOW_LOCAL_ADMIN ?? "1";
process.env.ADMIN_MFA_REQUIRED = process.env.ADMIN_MFA_REQUIRED ?? "false";
process.env.UI_E2E_ADMIN_ACCESS_IP_ALLOWLIST = process.env.UI_E2E_ADMIN_ACCESS_IP_ALLOWLIST ?? "*";

const args = process.argv.slice(2);
const runner = process.platform === "win32" ? "npx.cmd" : "npx";
const commandArgs = ["playwright", "test", "--config=playwright.config.ts", ...args];

const result = spawnSync(runner, commandArgs, {
  stdio: "inherit",
  env: process.env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
