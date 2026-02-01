// Loop simples para processar operações (worker) via endpoint interno.
// Requer ORYA_CRON_SECRET definido. Opcional: WORKER_API_URL, WORKER_INTERVAL_MS, WORKER_METHOD.
const fs = require("fs");
const path = require("path");

// Carrega .env.local minimamente (sem depender de dotenv)
function loadEnv() {
  if (process.env.ORYA_CRON_SECRET) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .forEach((line) => {
      const eq = line.indexOf("=");
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    });
}

loadEnv();

const secret = process.env.ORYA_CRON_SECRET;
if (!secret) {
  console.error("[worker] ORYA_CRON_SECRET em falta. Define no .env.local ou exporta e volta a correr.");
  process.exit(1);
}

const baseUrlRaw =
  process.env.WORKER_BASE_URL ||
  process.env.ORYA_BASE_URL ||
  process.env.APP_BASE_URL ||
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  `http://localhost:${process.env.NEXT_PORT || process.env.PORT || "3000"}`;
const baseUrl = baseUrlRaw.replace(/\/+$/, "");
const url = process.env.WORKER_API_URL || `${baseUrl}/api/cron/operations`;
const method = (process.env.WORKER_METHOD || "POST").toUpperCase();
const minIntervalMs = Number(process.env.WORKER_INTERVAL_MIN_MS || process.env.WORKER_INTERVAL_MS || "1000");
const maxIntervalMs = Number(process.env.WORKER_INTERVAL_MAX_MS || "10000");
const jitterPct = Number(process.env.WORKER_JITTER_PCT || "0.1");
const jitterMs = Number(process.env.WORKER_JITTER_MS || "0");
const verbose = process.env.WORKER_VERBOSE === "1" || process.env.WORKER_VERBOSE === "true";

function applyJitter(delayMs) {
  if (jitterMs > 0) {
    return delayMs + Math.floor(Math.random() * jitterMs);
  }
  if (jitterPct > 0) {
    return Math.max(0, Math.round(delayMs * (1 + Math.random() * jitterPct)));
  }
  return delayMs;
}

let stopped = false;
let failureCount = 0;
let currentIntervalMs = minIntervalMs;

async function tick() {
  if (stopped) return;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-ORYA-CRON-SECRET": secret,
      },
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      console.error("[worker] Falha a processar batch", {
        status: res.status,
        body: json,
      });
    } else if (json?.processed > 0) {
      failureCount = 0;
      console.log("[worker] Batch processado", {
        processed: json.processed,
      });
    } else {
      failureCount = 0;
    }

    if (json?.backoffMs && Number.isFinite(Number(json.backoffMs))) {
      currentIntervalMs = Math.min(maxIntervalMs, Math.max(minIntervalMs, Number(json.backoffMs)));
    } else if (json?.processed > 0) {
      currentIntervalMs = minIntervalMs;
    } else {
      currentIntervalMs = Math.min(maxIntervalMs, Math.round(currentIntervalMs * 1.5));
    }
    if (verbose) console.log("[worker] next interval", { currentIntervalMs });
  } catch (err) {
    failureCount += 1;
    const backoffMs = Math.min(maxIntervalMs, minIntervalMs * Math.pow(2, Math.min(failureCount, 5)));
    const cause = err && typeof err === "object" ? err.cause : null;
    const code = cause && typeof cause === "object" ? cause.code : null;
    const hint =
      code === "ECONNREFUSED"
        ? "Servidor indisponível. Confirma se o `npm run dev` está ativo."
        : "Falha a chamar o worker.";
    console.error("[worker] Erro no loop", { message: err?.message || err, hint, backoffMs });
    currentIntervalMs = backoffMs;
  } finally {
    if (!stopped) {
      const delay = applyJitter(currentIntervalMs);
      setTimeout(tick, delay);
    }
  }
}

process.on("SIGINT", () => {
  stopped = true;
  console.log("\n[worker] Terminado.");
  process.exit(0);
});

console.log(
  `[worker] A correr ${method} ${url} (interval ${minIntervalMs}ms→${maxIntervalMs}ms)`,
);
tick();
