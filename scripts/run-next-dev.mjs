#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const insecureTlsEnabled = process.env.ORYA_DEV_INSECURE_TLS === "1";

const env = {
  ...process.env,
};

if (insecureTlsEnabled) {
  env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("[dev] ORYA_DEV_INSECURE_TLS=1 ativo: TLS inseguro (NODE_TLS_REJECT_UNAUTHORIZED=0). Apenas para desenvolvimento local.");
} else if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;
}

const nextBinPath = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const hasLocalNext = fs.existsSync(nextBinPath);

const command = hasLocalNext ? process.execPath : "next";
const args = hasLocalNext ? [nextBinPath, "dev", ...argv] : ["dev", ...argv];

const child = spawn(command, args, {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[dev] erro ao arrancar Next dev:", error);
  process.exit(1);
});
