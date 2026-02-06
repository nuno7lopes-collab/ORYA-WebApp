#!/usr/bin/env node
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

function runCapture(cmd, args) {
  return new Promise((resolve) => {
    let stdout = "";
    const child = spawn(cmd, args, { env: process.env });
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
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

  const legacyAccessPattern =
    "inviteOnly|publicAccessMode|participantAccessMode|publicTicketTypeIds|participantTicketTypeIds|Event\\.isFree";
  const rgCode = await run("rg", ["-n", legacyAccessPattern, "app", "-S"]);
  if (rgCode === 0) {
    console.error("[db:gates] Legacy access fields detected in app/. Remove or move to deprecated read-models.");
    process.exit(1);
  }
  if (rgCode > 1) process.exit(1);

  const isFreeAllowlist = new Set([
    // Allowlist entries go here if we ever need legacy read-model exceptions.
  ]);
  const isFreeResult = await runCapture("rg", ["-n", "\\.isFree\\b", "app", "domain", "-S"]);
  if (isFreeResult.code === 0) {
    const violations = isFreeResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(":")[0])
      .filter((path) => !isFreeAllowlist.has(path));
    if (violations.length > 0) {
      console.error("[db:gates] Event.isFree usage detected outside allowlist:");
      violations.forEach((path) => console.error(`- ${path}`));
      process.exit(1);
    }
  } else if (isFreeResult.code > 1) {
    process.exit(1);
  }

  const piCreate = await run("rg", [
    "-n",
    "stripe\\.paymentIntents\\.create",
    "app",
    "lib",
    "domain",
    "-S",
    "-g",
    "!domain/finance/gateway/**",
  ]);
  if (piCreate === 0) {
    console.error("[db:gates] Direct stripe.paymentIntents.create detected outside gateway.");
    process.exit(1);
  }
  if (piCreate > 1) process.exit(1);

  const ledgerMutations = await run("rg", [
    "-n",
    "ledgerEntry\\.(update|delete)",
    "app",
    "lib",
    "domain",
    "-S",
  ]);
  if (ledgerMutations === 0) {
    console.error("[db:gates] LedgerEntry update/delete detected. Ledger is append-only.");
    process.exit(1);
  }
  if (ledgerMutations > 1) process.exit(1);

  const legacyIntent = await run("rg", [
    "-n",
    "LEGACY_INTENT_DISABLED",
    "app/api/payments/intent/route.ts",
    "-S",
  ]);
  if (legacyIntent === 0) {
    console.error("[db:gates] Legacy intent guard still present in /api/payments/intent.");
    process.exit(1);
  }
  if (legacyIntent > 1) process.exit(1);

  const tests = ["tests/finance", "tests/outbox"];
  if (await run("npx", ["vitest", "run", ...tests])) process.exit(1);
})();
