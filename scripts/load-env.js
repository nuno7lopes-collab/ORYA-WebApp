const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const root = process.cwd();
const envPath = path.join(root, ".env");
const envLocalPath = path.join(root, ".env.local");
const secretsPath = process.env.ORYA_SECRETS_FILE || "/tmp/orya-prod-secrets.json";
const secretsEnv = (process.env.ORYA_SECRETS_ENV || "prod").toLowerCase();

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

// Optional: load defaults from /tmp/orya-prod-secrets.json (for local scripts only)
function loadSecretsDefaults() {
  if (!fs.existsSync(secretsPath)) return;
  let raw;
  try {
    raw = fs.readFileSync(secretsPath, "utf8");
  } catch {
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  const flat = [];
  function walk(prefix, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        walk(prefix ? `${prefix}/${k}` : k, v);
      }
    } else {
      flat.push([prefix, value]);
    }
  }
  walk("", data);

  const token = `/orya/${secretsEnv}/`;
  for (const [pathKey, value] of flat) {
    if (typeof value !== "string") continue;
    if (!pathKey.includes(token)) continue;
    if (!value.trim()) continue;
    if (value.trim().startsWith("REPLACE_ME")) continue;
    const envKey = pathKey.split("/").slice(-1)[0];
    if (!process.env[envKey] || String(process.env[envKey]).trim() === "") {
      process.env[envKey] = value;
    }
  }
}

loadSecretsDefaults();
