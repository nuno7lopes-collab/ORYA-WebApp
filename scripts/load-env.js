const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const root = process.cwd();
const envPath = path.join(root, ".env");
const envLocalPath = path.join(root, ".env.local");
const secretsPath = process.env.ORYA_SECRETS_FILE || "/tmp/orya-prod-secrets.json";
const secretsEnv = (process.env.ORYA_SECRETS_ENV || "prod").toLowerCase();
const requestedDbMode = String(process.env.ORYA_DB_MODE || "cloud").toLowerCase();
const resolvedDbMode = requestedDbMode === "local" ? "local" : "cloud";

if (requestedDbMode !== resolvedDbMode) {
  console.warn(`[env] ORYA_DB_MODE inválido (${requestedDbMode}); a usar '${resolvedDbMode}'.`);
}

process.env.ORYA_DB_MODE_RESOLVED = resolvedDbMode;

const sourceByKey = new Map();

function hasValue(value) {
  return value != null && String(value).trim() !== "";
}

function setEnvValue(key, value, source) {
  process.env[key] = value;
  sourceByKey.set(key, source);
}

function applyEnvFile(filePath, options = { override: false, onlyIfUnset: true }) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = dotenv.parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (options.onlyIfUnset) {
      if (!hasValue(process.env[key])) {
        setEnvValue(key, value, path.basename(filePath));
      }
      continue;
    }
    if (options.override) {
      setEnvValue(key, value, path.basename(filePath));
    } else if (!hasValue(process.env[key])) {
      setEnvValue(key, value, path.basename(filePath));
    }
  }
  return parsed;
}

for (const [key, value] of Object.entries(process.env)) {
  if (hasValue(value)) {
    sourceByKey.set(key, "process");
  }
}

// Ordem: .env (base) → .env.local (override local), sem sobrepor env já existente de CI.
const beforeEnv = new Set(Object.keys(process.env));
applyEnvFile(envPath, { onlyIfUnset: true });
if (fs.existsSync(envLocalPath)) {
  const raw = fs.readFileSync(envLocalPath, "utf8");
  const parsed = dotenv.parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (beforeEnv.has(key) && hasValue(process.env[key])) continue; // não sobrescreve env de shell/CI
    if (hasValue(value)) {
      setEnvValue(key, value, ".env.local");
    }
  }
}

// Optional: load defaults from /tmp/orya-prod-secrets.json (for local scripts only)
function loadSecretsDefaults() {
  if (resolvedDbMode !== "cloud") return;
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
    if (!hasValue(process.env[envKey])) {
      setEnvValue(envKey, value, `secrets:${secretsPath}`);
    }
  }
}

loadSecretsDefaults();

const dbUrlSource = sourceByKey.get("DATABASE_URL") || "unset";
const directUrlSource = sourceByKey.get("DIRECT_URL") || "unset";
const explicitSources = new Set(["process", ".env", ".env.local"]);
const dbUrlsExplicit = explicitSources.has(dbUrlSource) && explicitSources.has(directUrlSource);

process.env.ORYA_DATABASE_URL_SOURCE = dbUrlSource;
process.env.ORYA_DIRECT_URL_SOURCE = directUrlSource;
process.env.ORYA_DB_URL_EXPLICIT = dbUrlsExplicit ? "1" : "0";
