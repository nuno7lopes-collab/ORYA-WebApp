// Loop simples para processar operações (worker) via endpoint interno.
// Requer ORYA_CRON_SECRET definido. Opcional: WORKER_API_URL, WORKER_INTERVAL_MS.
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

const url = process.env.WORKER_API_URL || "http://localhost:3000/api/cron/operations";
const intervalMs = Number(process.env.WORKER_INTERVAL_MS || "1000");

let stopped = false;

async function tick() {
  if (stopped) return;
  try {
    const res = await fetch(url, {
      method: "POST",
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
      console.log("[worker] Batch processado", {
        processed: json.processed,
      });
    }
  } catch (err) {
    console.error("[worker] Erro no loop", err);
  } finally {
    if (!stopped) {
      setTimeout(tick, intervalMs);
    }
  }
}

process.on("SIGINT", () => {
  stopped = true;
  console.log("\n[worker] Terminado.");
  process.exit(0);
});

console.log(`[worker] A correr contra ${url} a cada ${intervalMs}ms`);
tick();
