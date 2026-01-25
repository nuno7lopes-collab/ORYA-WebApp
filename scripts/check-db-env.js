/* eslint-disable no-console */
const required = ["DATABASE_URL", "DIRECT_URL"];
const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

if (missing.length > 0) {
  console.error(`[db:env] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("[db:env] OK");
