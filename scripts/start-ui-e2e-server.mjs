#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./load-env.js");

const resolvedBaseUrl =
  process.env.UI_E2E_BASE_URL ?? process.env.ORYA_E2E_BASE_URL ?? "http://127.0.0.1:33123";

function resolvePort(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.port) return parsed.port;
  } catch {
    // fallback below
  }
  return "33123";
}

const port = resolvePort(resolvedBaseUrl);

const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "--webpack", "--port", port],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e",
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      ALLOW_LOCAL_ADMIN: process.env.ALLOW_LOCAL_ADMIN ?? "1",
      ADMIN_MFA_REQUIRED: process.env.ADMIN_MFA_REQUIRED ?? "false",
      ADMIN_ACCESS_IP_ALLOWLIST: process.env.UI_E2E_ADMIN_ACCESS_IP_ALLOWLIST ?? "*",
    },
  },
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
