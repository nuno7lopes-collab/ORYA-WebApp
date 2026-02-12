// Local cron runner for multiple endpoints.
const fs = require("fs");
const path = require("path");

function loadEnv() {
  if (process.env.ORYA_CRON_SECRET && process.env.NEXT_PUBLIC_BASE_URL) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
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
  console.error("[cron-loop] Missing ORYA_CRON_SECRET. Set it in .env.local or export and retry.");
  process.exit(1);
}

const explicitBaseUrl =
  process.env.ORYA_BASE_URL ||
  process.env.APP_BASE_URL ||
  process.env.BASE_URL ||
  process.env.WORKER_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL;

const isDev = process.env.NODE_ENV === "development";
const nextPort = process.env.NEXT_PORT || process.env.PORT || "3000";
const baseUrlRaw = explicitBaseUrl || (isDev ? `http://localhost:${nextPort}` : "http://localhost:3000");

if (isDev && baseUrlRaw.includes("orya.pt")) {
  console.error(
    `[cron-loop] Refusing to run against production URL in development: ${baseUrlRaw}`,
  );
  process.exit(1);
}
const baseUrl = baseUrlRaw.replace(/\/+$/, "");
const verbose = process.env.CRON_VERBOSE === "1" || process.env.CRON_VERBOSE === "true";
const defaultMaxConcurrency = process.env.NODE_ENV === "development" ? "2" : "0";
const maxConcurrencyRaw = Number(process.env.CRON_MAX_CONCURRENCY || defaultMaxConcurrency);
const maxConcurrency =
  Number.isFinite(maxConcurrencyRaw) && maxConcurrencyRaw > 0 ? maxConcurrencyRaw : Number.POSITIVE_INFINITY;

let activeCount = 0;
const queue = [];

function acquireSlot() {
  if (!Number.isFinite(maxConcurrency) || maxConcurrency === Number.POSITIVE_INFINITY) {
    activeCount += 1;
    return Promise.resolve();
  }
  if (activeCount < maxConcurrency) {
    activeCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve)).then(() => {
    activeCount += 1;
  });
}

function releaseSlot() {
  activeCount = Math.max(0, activeCount - 1);
  if (queue.length > 0 && activeCount < maxConcurrency) {
    const next = queue.shift();
    if (next) next();
  }
}

function parseList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getInterval(name, fallback) {
  const raw = process.env[name] ?? process.env.CRON_INTERVAL_MS;
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

const jitterPct = Number(process.env.CRON_JITTER_PCT || "0.1");
const jitterMs = Number(process.env.CRON_JITTER_MS || "0");
const maxBackoffMs = Number(process.env.CRON_MAX_BACKOFF_MS || "60000");
const startJitterMs = Number(process.env.CRON_START_JITTER_MS || "15000");
const startSpreadMs = Number(process.env.CRON_START_SPREAD_MS || "20000");

function applyJitter(delayMs) {
  if (jitterMs > 0) {
    return delayMs + Math.floor(Math.random() * jitterMs);
  }
  if (jitterPct > 0) {
    return Math.max(0, Math.round(delayMs * (1 + Math.random() * jitterPct)));
  }
  return delayMs;
}

function getStartDelay(intervalMs, index, totalJobs) {
  const jitterWindow = Math.min(Math.max(startJitterMs, 0), intervalMs);
  const jitterDelay = jitterWindow > 0 ? Math.floor(Math.random() * jitterWindow) : 0;
  const spreadWindow = Math.min(Math.max(startSpreadMs, 0), intervalMs);
  const spreadDelay =
    totalJobs > 1 && spreadWindow > 0
      ? Math.floor((spreadWindow * index) / (totalJobs - 1))
      : 0;
  return jitterDelay + spreadDelay;
}

const jobs = [
  {
    name: "operations",
    method: "POST",
    path: "/api/cron/operations",
    intervalMs: getInterval("CRON_OPERATIONS_INTERVAL_MS", 1000),
  },
  {
    name: "bookings-cleanup",
    method: "GET",
    path: "/api/cron/bookings/cleanup",
    intervalMs: getInterval("CRON_BOOKINGS_INTERVAL_MS", 60000),
  },
  {
    name: "reservations-cleanup",
    method: "GET",
    path: "/api/cron/reservations/cleanup",
    intervalMs: getInterval("CRON_RESERVATIONS_INTERVAL_MS", 60000),
  },
  {
    name: "credits-expire",
    method: "GET",
    path: "/api/cron/creditos/expire",
    intervalMs: getInterval("CRON_CREDITS_INTERVAL_MS", 300000),
  },
  {
    name: "padel-expire",
    method: "POST",
    path: "/api/cron/padel/expire",
    intervalMs: getInterval("CRON_PADEL_EXPIRE_INTERVAL_MS", 300000),
  },
  {
    name: "padel-matchmaking",
    method: "POST",
    path: "/api/cron/padel/matchmaking",
    intervalMs: getInterval("CRON_PADEL_MATCHMAKING_INTERVAL_MS", 300000),
  },
  {
    name: "padel-split-reminders",
    method: "POST",
    path: "/api/cron/padel/split-reminders",
    intervalMs: getInterval("CRON_PADEL_SPLIT_REMINDERS_INTERVAL_MS", 300000),
  },
  {
    name: "padel-waitlist",
    method: "POST",
    path: "/api/cron/padel/waitlist",
    intervalMs: getInterval("CRON_PADEL_WAITLIST_INTERVAL_MS", 300000),
  },
  {
    name: "padel-reminders",
    method: "POST",
    path: "/api/cron/padel/reminders",
    intervalMs: getInterval("CRON_PADEL_REMINDERS_INTERVAL_MS", 300000),
  },
  {
    name: "padel-tournament-eve",
    method: "POST",
    path: "/api/cron/padel/tournament-eve",
    intervalMs: getInterval("CRON_PADEL_TOURNAMENT_EVE_INTERVAL_MS", 3600000),
  },
  {
    name: "entitlements-qr-cleanup",
    method: "GET",
    path: "/api/cron/entitlements/qr-cleanup",
    intervalMs: getInterval("CRON_ENTITLEMENTS_QR_CLEANUP_INTERVAL_MS", 3600000),
  },
  {
    name: "crm-rebuild",
    method: "POST",
    path: "/api/cron/crm/rebuild",
    intervalMs: getInterval("CRON_CRM_REBUILD_INTERVAL_MS", 86400000),
  },
  {
    name: "crm-campanhas",
    method: "POST",
    path: "/api/cron/crm/campanhas",
    intervalMs: getInterval("CRON_CRM_CAMPAIGNS_INTERVAL_MS", 60000),
  },
  {
    name: "repair-usernames",
    method: "POST",
    path: "/api/cron/repair-usernames",
    intervalMs: getInterval("CRON_REPAIR_USERNAMES_INTERVAL_MS", 604800000),
  },
  {
    name: "analytics-rollup",
    method: "POST",
    path: "/api/cron/analytics/rollup",
    intervalMs: getInterval("CRON_ANALYTICS_INTERVAL_MS", 86400000),
  },
  {
    name: "loyalty-expire",
    method: "POST",
    path: "/api/cron/loyalty/expire",
    intervalMs: getInterval("CRON_LOYALTY_EXPIRE_INTERVAL_MS", 86400000),
  },
];

const only = new Set(parseList(process.env.CRON_ONLY));
const skip = new Set(parseList(process.env.CRON_SKIP));

const enabledJobs = jobs.filter((job) => {
  if (only.size > 0 && !only.has(job.name)) return false;
  if (skip.has(job.name)) return false;
  return true;
});

if (enabledJobs.length === 0) {
  console.error("[cron-loop] No jobs enabled. Check CRON_ONLY/CRON_SKIP.");
  process.exit(1);
}

let stopped = false;

function resolveWaitTarget(base, maybePath) {
  const raw = (maybePath || "").trim();
  if (!raw) return base;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${normalizedPath}`;
}

async function waitForServer(url, maxWaitMs, headers) {
  if (!maxWaitMs || maxWaitMs <= 0) return true;
  const startedAt = Date.now();
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      await fetch(url, {
        signal: controller.signal,
        headers,
        redirect: "manual",
      });
      clearTimeout(timeout);
      return true;
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= maxWaitMs) return false;
      const delay = Math.min(2000, 250 * attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function logJob(job, message, extra) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[cron-loop] ${job.name} ${message}${suffix}`);
}

function makeRunner(job) {
  let running = false;
  let failureCount = 0;

  const run = async () => {
    if (stopped || running) return;
    running = true;
    await acquireSlot();
    const url = `${baseUrl}${job.path}`;
    let json = null;
    try {
      const res = await fetch(url, {
        method: job.method,
        headers: { "X-ORYA-CRON-SECRET": secret },
      });
      json = await res.json().catch(() => null);
      if (!res.ok || (json && json.ok === false)) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (verbose) logJob(job, "ok", json);
      failureCount = 0;
    } catch (err) {
      failureCount += 1;
      const backoffMs = Math.min(maxBackoffMs, job.intervalMs * Math.pow(2, Math.min(failureCount, 5)));
      const message = err && typeof err === "object" ? err.message : String(err);
      logJob(job, `error: ${message}`, { backoffMs });
    } finally {
      releaseSlot();
      running = false;
      if (!stopped) {
        let delay = job.intervalMs;
        if (failureCount > 0) {
          delay = Math.min(maxBackoffMs, job.intervalMs * Math.pow(2, Math.min(failureCount, 5)));
        } else if (json?.backoffMs && Number.isFinite(Number(json.backoffMs))) {
          delay = Math.max(job.intervalMs, Number(json.backoffMs));
        }
        setTimeout(run, applyJitter(delay));
      }
    }
  };

  const initialDelay = getStartDelay(job.intervalMs, job.startIndex, job.totalJobs);
  if (initialDelay > 0) {
    setTimeout(run, initialDelay);
  } else {
    run();
  }
}

async function start() {
  const waitMs = Number(process.env.CRON_WAIT_MS || "30000");
  const waitPath = process.env.CRON_WAIT_PATH || "/api/internal/ping";
  const waitUrl = resolveWaitTarget(baseUrl, waitPath);
  const waitHeaders = secret ? { "X-ORYA-CRON-SECRET": secret } : undefined;
  console.log("[cron-loop] Base URL:", baseUrl);
  console.log("[cron-loop] Wait URL:", waitUrl);
  console.log(
    "[cron-loop] Jobs:",
    enabledJobs.map((job) => `${job.name}(${job.method} ${job.path} @${job.intervalMs}ms)`).join(", "),
  );
  console.log(`[cron-loop] Waiting for server: ${waitMs}ms max`);
  const ready = await waitForServer(waitUrl, waitMs, waitHeaders);
  if (!ready) {
    console.log("[cron-loop] Server not ready within wait window, starting anyway.");
  }

  const totalJobs = enabledJobs.length;
  enabledJobs.forEach((job, index) => {
    makeRunner({
      ...job,
      startIndex: index,
      totalJobs,
    });
  });
}

start();

process.on("SIGINT", () => {
  stopped = true;
  console.log("\n[cron-loop] Stopped.");
  process.exit(0);
});
