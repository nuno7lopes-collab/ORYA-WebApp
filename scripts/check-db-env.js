const required = ["DATABASE_URL", "DIRECT_URL"];
const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

if (missing.length > 0) {
  console.error(`[db:env] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

function parseDbUrl(rawValue, envKey) {
  try {
    return new URL(rawValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db:env] Invalid ${envKey}: ${message}`);
    process.exit(1);
  }
}

function sanitizeDbTarget(parsed) {
  const host = parsed.hostname || "-";
  const port = parsed.port || "5432";
  const dbName = decodeURIComponent((parsed.pathname || "/").replace(/^\//, "")) || "-";
  return { host, port, dbName };
}

const databaseUrl = parseDbUrl(process.env.DATABASE_URL, "DATABASE_URL");
const directUrl = parseDbUrl(process.env.DIRECT_URL, "DIRECT_URL");
const target = sanitizeDbTarget(directUrl);
const mode = process.env.ORYA_DB_MODE_RESOLVED || process.env.ORYA_DB_MODE || "cloud";
const dbSource = process.env.ORYA_DATABASE_URL_SOURCE || "unknown";
const directSource = process.env.ORYA_DIRECT_URL_SOURCE || "unknown";
const explicit = process.env.ORYA_DB_URL_EXPLICIT === "1";
const deployGuardEnabled = String(process.env.DB_DEPLOY_GUARD || "") === "1";
const deployAck = String(process.env.DB_DEPLOY_ACK || "");

console.log(
  `[db:env] target=${target.host}:${target.port}/${target.dbName} mode=${mode} source(DATABASE_URL)=${dbSource} source(DIRECT_URL)=${directSource}`,
);

if (deployGuardEnabled) {
  if (deployAck !== "YES") {
    console.error("[db:env] proteção: migrations não correm sem confirmação (define DB_DEPLOY_ACK=YES).");
    process.exit(1);
  }
  if (!explicit) {
    console.error(
      "[db:env] proteção: DATABASE_URL/DIRECT_URL não estão explícitas (source=secrets/implicit). Define-as explicitamente antes de correr db:deploy.",
    );
    process.exit(1);
  }
}

if (!databaseUrl.protocol.startsWith("postgres")) {
  console.error("[db:env] DATABASE_URL tem de usar protocolo postgres.");
  process.exit(1);
}
if (!directUrl.protocol.startsWith("postgres")) {
  console.error("[db:env] DIRECT_URL tem de usar protocolo postgres.");
  process.exit(1);
}

console.log("[db:env] OK");
