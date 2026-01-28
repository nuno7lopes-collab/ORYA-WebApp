#!/usr/bin/env node
const path = require("path");
const { spawn } = require("child_process");

// Autoload .env + .env.local via shared loader (same order as app)
require(path.join(__dirname, "..", "load-env.js"));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("[db:prisma] Missing prisma args");
  process.exit(1);
}

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
process.env.CHECKPOINT_DISABLE = "1";
process.env.PRISMA_CACHE_DIR = process.env.PRISMA_CACHE_DIR || path.join(process.cwd(), ".cache", "prisma");
process.env.npm_config_cache = process.env.npm_config_cache || path.join(process.cwd(), ".cache", "npm");

const env = { ...process.env };

const delaysMs = [1000, 3000, 7000];

function validateUrls() {
  const required = ["DATABASE_URL", "DIRECT_URL"];
  const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
  if (missing.length > 0) {
    console.error(`[db:prisma] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
  try {
    new URL(process.env.DATABASE_URL);
    new URL(process.env.DIRECT_URL);
  } catch (err) {
    console.error(`[db:prisma] Invalid DATABASE_URL/DIRECT_URL: ${(err && err.message) || err}`);
    process.exit(1);
  }
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(prismaBin, args, { env, stdio: ["inherit", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

(async () => {
  validateUrls();
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    const result = await runOnce();
    if (result.code === 0) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(0);
    }

    const errText = `${result.stderr}\n${result.stdout}`;
    const isTransient =
      errText.includes("P1001") ||
      errText.includes("ETIMEDOUT") ||
      errText.includes("ECONNRESET") ||
      errText.includes("ENOTFOUND");
    if (isTransient && attempt < delaysMs.length) {
      console.warn(`[db:prisma] retry em ${delaysMs[attempt]}ms`);
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      continue;
    }
    if (errText.includes("P1001")) {
      console.error("DB unreachable (P1001) — não é código; verifica rede/VPN/DNS");
      process.exit(1);
    }

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.code || 1);
  }
})();
