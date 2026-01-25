#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("node:path");
const { spawn } = require("node:child_process");

require(path.join(__dirname, "..", "load-env.js"));

process.env.CHECKPOINT_DISABLE = "1";
process.env.PRISMA_CACHE_DIR = process.env.PRISMA_CACHE_DIR || path.join(process.cwd(), ".cache", "prisma");
process.env.npm_config_cache = process.env.npm_config_cache || path.join(process.cwd(), ".cache", "npm");

const isOffline =
  String(process.env.DB_GATES_MODE || "").toLowerCase() === "offline" ||
  String(process.env.DB_GATES_OFFLINE || "") === "1";

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

(async () => {
  if (!isOffline) {
    if (await run("npm", ["run", "db:status"])) process.exit(1);
    if (await run("npm", ["run", "db:deploy"])) process.exit(1);
    if (await run("npm", ["run", "db:generate"])) process.exit(1);
  } else {
    if (await run("node", ["./scripts/db/prisma-retry.js", "validate", "--schema=prisma/schema.prisma"])) process.exit(1);
    if (await run("node", ["./scripts/db/prisma-retry.js", "generate", "--schema=prisma/schema.prisma"])) process.exit(1);
  }

  const tests = ["tests/finance", "tests/outbox"];
  if (await run("npx", ["vitest", "run", ...tests])) process.exit(1);
})();
