const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const root = process.cwd();
const envPath = path.join(root, ".env");
const envLocalPath = path.join(root, ".env.local");

function applyEnvFile(filePath, options = { override: false, onlyIfUnset: true }) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = dotenv.parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (options.onlyIfUnset) {
      if (process.env[key] == null || String(process.env[key]).trim() === "") {
        process.env[key] = value;
      }
      continue;
    }
    if (options.override) {
      process.env[key] = value;
    } else if (process.env[key] == null || String(process.env[key]).trim() === "") {
      process.env[key] = value;
    }
  }
  return parsed;
}

// Ordem: .env (base) → .env.local (override local), sem sobrepor env já existente de CI.
const beforeEnv = new Set(Object.keys(process.env));
applyEnvFile(envPath, { onlyIfUnset: true });
const afterEnv = new Set(Object.keys(process.env));
const keysFromEnv = new Set(
  Array.from(afterEnv).filter((key) => !beforeEnv.has(key)),
);
if (fs.existsSync(envLocalPath)) {
  const raw = fs.readFileSync(envLocalPath, "utf8");
  const parsed = dotenv.parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (beforeEnv.has(key)) continue; // não sobrescreve env de CI
    if (keysFromEnv.has(key) || process.env[key] == null || String(process.env[key]).trim() === "") {
      process.env[key] = value; // override sobre .env
    }
  }
}
