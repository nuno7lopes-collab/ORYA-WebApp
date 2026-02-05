// Run the local dev server plus all cron loops in one command.
const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const repoRoot = path.resolve(__dirname, "..");
const lockPath = path.join(repoRoot, ".dev-all.lock");

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

function loadSecretsJson() {
  if (process.env.DEV_ALL_SKIP_SECRETS === "1") return;
  const secretsPath = process.env.ORYA_SECRETS_PATH || "/tmp/orya-prod-secrets.json";
  if (!fs.existsSync(secretsPath)) return;
  try {
    const raw = fs.readFileSync(secretsPath, "utf8");
    const parsed = JSON.parse(raw);
    const forceKeys = new Set(["DATABASE_URL", "DIRECT_URL"]);
    const apply = (node) => {
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          apply(value);
          continue;
        }
        if (typeof value !== "string") continue;
        if (!value.trim()) continue;
        if (value.startsWith("REPLACE_ME")) continue;
        if (forceKeys.has(key) || !process.env[key]) process.env[key] = value;
      }
    };
    apply(parsed);
  } catch (err) {
    console.log(`[dev-all] Failed to load secrets from ${secretsPath}: ${err?.message || err}`);
  }
}

loadSecretsJson();

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const stripeCmd = process.platform === "win32" ? "stripe.exe" : "stripe";
const redisCmd = process.platform === "win32" ? "redis-server.exe" : "redis-server";

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function ensureNodeModules() {
  if (process.env.DEV_ALL_SKIP_INSTALL === "1") return;
  const nodeModulesPath = path.join(repoRoot, "node_modules");
  const missingNodeModules = !fs.existsSync(nodeModulesPath);
  const missingCostExplorer = !fs.existsSync(
    path.join(repoRoot, "node_modules", "@aws-sdk", "client-cost-explorer"),
  );

  if (!missingNodeModules && !missingCostExplorer) return;

  console.log("[dev-all] Installing dependencies (npm install)...");
  try {
    execSync(`${npmCmd} install --no-audit --no-fund`, { stdio: "inherit", cwd: repoRoot });
  } catch (err) {
    console.log("[dev-all] npm install failed. You can re-run with DEV_ALL_SKIP_INSTALL=1 to bypass.");
  }
}

ensureNodeModules();

function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return !["0", "false", "no"].includes(String(value).toLowerCase());
}

function run(label, cmd, args, extraEnv) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...(extraEnv || {}) },
  });

  child.on("error", (err) => {
    if (err && err.code === "ENOENT") {
      console.log(`[dev-all] ${label} not found (${cmd}). Skipping.`);
    } else {
      console.log(`[dev-all] ${label} error`, err?.message || err);
    }
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev-all] ${label} exited with signal ${signal}`);
    } else {
      console.log(`[dev-all] ${label} exited with code ${code}`);
    }
  });

  return child;
}

function runCmd(command) {
  try {
    return execSync(command, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch (err) {
    return String(err?.stdout || "").trim();
  }
}

function isPidAlive(pid) {
  if (!Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid() {
  if (!fs.existsSync(lockPath)) return null;
  const raw = fs.readFileSync(lockPath, "utf8").trim();
  const pid = Number(raw);
  return Number.isFinite(pid) ? pid : null;
}

function releaseLock() {
  if (!fs.existsSync(lockPath)) return;
  const pid = readLockPid();
  if (pid === process.pid) {
    fs.rmSync(lockPath, { force: true });
  }
}

function claimLock() {
  const existingPid = readLockPid();
  if (existingPid && isPidAlive(existingPid)) {
    const command = getCommandForPid(existingPid);
    const isDevAll = command.includes("dev-all.js");
    const isRepo = command.includes(repoRoot);
    if (isDevAll && isRepo) {
      console.log(`[dev-all] Found existing dev-all PID ${existingPid}. Stopping it.`);
      try {
        process.kill(existingPid, "SIGKILL");
      } catch (err) {
        console.log(`[dev-all] Failed to stop previous dev-all PID ${existingPid}: ${err?.message || err}`);
      }
    } else {
      console.log("[dev-all] Another dev-all lock exists. Remove .dev-all.lock if it's stale.");
      process.exit(1);
    }
  }
  fs.writeFileSync(lockPath, String(process.pid));
  process.on("exit", releaseLock);
  process.on("SIGINT", releaseLock);
  process.on("SIGTERM", releaseLock);
}

claimLock();

function listProcesses() {
  const psOutput = runCmd("ps -ax -o pid=,command=");
  return psOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const pid = Number(parts[0]);
      const command = parts.slice(1).join(" ");
      return { pid, command };
    })
    .filter(({ pid }) => Number.isFinite(pid));
}

function findListeningPids(port) {
  const output = runCmd(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp`);
  if (!output) return [];
  return output
    .split("\n")
    .filter((line) => line.startsWith("p"))
    .map((line) => Number(line.slice(1)))
    .filter((pid) => Number.isFinite(pid));
}

function getCommandForPid(pid) {
  return runCmd(`ps -p ${pid} -o command=`) || "";
}

function maybeKillPid(pid, patterns, requireRepo = true) {
  const command = getCommandForPid(pid);
  if (!command) return false;
  const matchesRepo = command.includes(repoRoot);
  const matchesPattern = patterns.some((pattern) => command.includes(pattern));
  if (!matchesPattern) return false;
  if (requireRepo && !matchesRepo) return false;
  try {
    process.kill(pid, "SIGKILL");
    console.log(`[dev-all] Killed PID ${pid} (${command.trim()}).`);
    return true;
  } catch (err) {
    console.log(`[dev-all] Failed to kill PID ${pid}: ${err?.message || err}`);
    return false;
  }
}

function killProcessesMatching(patterns, requireRepo = true) {
  const processes = listProcesses();
  for (const proc of processes) {
    if (!patterns.some((pattern) => proc.command.includes(pattern))) continue;
    if (requireRepo && !proc.command.includes(repoRoot)) continue;
    maybeKillPid(proc.pid, patterns, requireRepo);
  }
}

function killPortProcesses(port, patterns, requireRepo = true) {
  const pids = findListeningPids(port);
  if (!pids.length) return;
  for (const pid of pids) {
    const command = getCommandForPid(pid);
    if (!patterns.some((pattern) => command.includes(pattern))) continue;
    maybeKillPid(pid, patterns, requireRepo);
  }
}

function cleanupPort(port, patterns) {
  const pids = findListeningPids(port);
  if (!pids.length) return;
  for (const pid of pids) {
    maybeKillPid(pid, patterns);
  }
}

function findAvailablePort(startPort, maxAttempts = 5) {
  for (let offset = 0; offset <= maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (!findListeningPids(port).length) return port;
  }
  return startPort;
}

function findRepoNextDevPids() {
  return listProcesses()
    .filter(
      ({ command }) =>
        command.includes(repoRoot) &&
        (command.includes("next dev") || command.includes("node_modules/.bin/next")),
    )
    .map(({ pid }) => pid);
}

function cleanupNextDevLockIfIdle() {
  const lockPath = path.join(repoRoot, ".next", "dev", "lock");
  if (!fs.existsSync(lockPath)) return;
  const hasLsof = Boolean(runCmd("command -v lsof"));
  if (hasLsof) {
    const output = runCmd(`lsof -nP ${lockPath} -Fp`);
    const pids = output
      .split("\n")
      .filter((line) => line.startsWith("p"))
      .map((line) => Number(line.slice(1)))
      .filter((pid) => Number.isFinite(pid));
    if (pids.length > 0) {
      for (const pid of pids) {
        maybeKillPid(pid, ["next dev", "node_modules/.bin/next"]);
      }
      const remaining = findRepoNextDevPids();
      if (remaining.length === 0) {
        fs.rmSync(lockPath, { force: true });
        console.log("[dev-all] Removed .next/dev/lock after killing Next dev.");
      }
      return;
    }
  }

  const repoNextPids = findRepoNextDevPids();
  if (repoNextPids.length > 0) {
    for (const pid of repoNextPids) {
      maybeKillPid(pid, ["next dev", "node_modules/.bin/next"]);
    }
  }
  const remaining = findRepoNextDevPids();
  if (remaining.length === 0) {
    fs.rmSync(lockPath, { force: true });
    console.log("[dev-all] Removed stale .next/dev/lock.");
  }
}

function sanitizeStripeCliEnv(env) {
  const stripeEnv = { ...env };
  const apiKey = stripeEnv.STRIPE_API_KEY;
  const secretKey = stripeEnv.STRIPE_SECRET_KEY;

  const isLiveKey = (val) =>
    typeof val === "string" &&
    (val.startsWith("sk_live_") || val.startsWith("rk_live_"));
  const isTestSecretKey = (val) =>
    typeof val === "string" && val.startsWith("sk_test_");

  if (apiKey && isLiveKey(apiKey)) {
    delete stripeEnv.STRIPE_API_KEY;
  }

  if (!stripeEnv.STRIPE_API_KEY && secretKey) {
    if (isTestSecretKey(secretKey)) {
      stripeEnv.STRIPE_API_KEY = secretKey;
    } else if (isLiveKey(secretKey)) {
      delete stripeEnv.STRIPE_SECRET_KEY;
    }
  }

  if (!stripeEnv.STRIPE_API_KEY) {
    console.log(
      "[dev-all] Stripe CLI: no test key detected. Using `stripe login` session if available.",
    );
  }

  return stripeEnv;
}

function resetDevState() {
  // Kill repo-scoped dev processes.
  killProcessesMatching(["operations-loop.js", "cron-loop.js", "chat-ws-server.js"], true);
  killProcessesMatching(["stripe listen"], false);
  // Kill Next servers bound to common dev ports.
  [3000, 3001, 3002, 3003].forEach((port) => {
    killPortProcesses(port, ["next dev", "next-server", "node_modules/.bin/next"], false);
  });
  // Clean Next cache to avoid stale locks.
  const nextDir = path.join(repoRoot, ".next");
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("[dev-all] Removed .next cache.");
  }
}

resetDevState();

cleanupPort(3000, ["next dev", "node_modules/.bin/next"]);
cleanupPort(3001, ["next dev", "node_modules/.bin/next"]);
cleanupPort(4001, ["chat-ws-server.js"]);
cleanupNextDevLockIfIdle();

const localHost = process.env.HOSTNAME || "127.0.0.1";
process.env.HOSTNAME = localHost;

const baseNextPort = Number(process.env.NEXT_PORT || process.env.PORT || 3000);
const nextPort = findAvailablePort(baseNextPort, 5);
if (nextPort !== baseNextPort) {
  console.log(`[dev-all] NEXT_PORT ${baseNextPort} ocupado. Usando ${nextPort}.`);
}
process.env.NEXT_PORT = String(nextPort);
process.env.PORT = String(nextPort);
if (!process.env.ORYA_BASE_URL) {
  process.env.ORYA_BASE_URL = `http://${localHost}:${nextPort}`;
}
if (!process.env.WORKER_BASE_URL) {
  process.env.WORKER_BASE_URL = process.env.ORYA_BASE_URL;
}

const baseChatWsPort = Number(process.env.CHAT_WS_PORT || 4001);
const chatWsPort = findAvailablePort(baseChatWsPort, 5);
if (chatWsPort !== baseChatWsPort) {
  console.log(`[dev-all] CHAT_WS_PORT ${baseChatWsPort} ocupado. Usando ${chatWsPort}.`);
}

process.env.CHAT_WS_PORT = String(chatWsPort);
if (!process.env.CHAT_WS_HOST) {
  process.env.CHAT_WS_HOST = localHost;
}
if (!process.env.NEXT_PUBLIC_CHAT_WS_URL) {
  process.env.NEXT_PUBLIC_CHAT_WS_URL = `ws://${localHost}:${chatWsPort}`;
}

const children = [
  run("dev", npmCmd, ["run", "dev", "--", "--hostname", localHost]),
];

let deferredStarted = false;

function startDeferredServices() {
  if (deferredStarted) return;
  deferredStarted = true;
  console.log("[dev-all] Server ready. Starting cron/worker/services...");

  children.push(run("cron", npmCmd, ["run", "cron:local"]));

  const startWorker = parseBool(process.env.START_WORKER, true);
  if (startWorker) {
    children.push(run("worker", npmCmd, ["run", "worker"]));
  }

  const startChatWs = parseBool(process.env.START_CHAT_WS, true);
  if (startChatWs) {
    const chatWsEnv = {
      CHAT_POLLING_ONLY: "0",
      NEXT_PUBLIC_CHAT_POLLING_ONLY: "0",
    };
    children.push(run("chat-ws", npmCmd, ["run", "chat:ws"], chatWsEnv));
  }

  const startRedis = parseBool(process.env.START_REDIS, true);
  if (startRedis) {
    const redisPort = process.env.REDIS_PORT || "6379";
    children.push(run("redis", redisCmd, ["--port", redisPort]));
  }

  const startStripe = parseBool(process.env.START_STRIPE, true);
  if (startStripe) {
    const baseUrlRaw =
      process.env.STRIPE_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");
    const forwardTo =
      process.env.STRIPE_FORWARD_URL || `${baseUrl}/api/stripe/webhook`;
    const connectForwardTo =
      process.env.STRIPE_CONNECT_FORWARD_URL ||
      `${baseUrl}/api/organizacao/payouts/webhook`;

    const stripeEnv = sanitizeStripeCliEnv(process.env);

    children.push(
      run("stripe", stripeCmd, ["listen", "--forward-to", forwardTo], stripeEnv),
    );

    const startStripeConnect = parseBool(process.env.START_STRIPE_CONNECT, true);
    if (startStripeConnect) {
      children.push(
        run(
          "stripe-connect",
          stripeCmd,
          ["listen", "--forward-to", connectForwardTo, "--events", "account.updated"],
          stripeEnv,
        ),
      );
    }
  }
}

function fetchStatus(url, headers) {
  return new Promise((resolve) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.request(url, { method: "GET", headers }, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode));
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

async function checkServerReady() {
  const baseUrl = process.env.ORYA_BASE_URL || `http://${localHost}:${nextPort}`;
  const targetUrl = process.env.ORYA_CRON_SECRET
    ? `${baseUrl.replace(/\/+$/, "")}/api/internal/ops/health`
    : baseUrl;
  const headers = process.env.ORYA_CRON_SECRET
    ? { "X-ORYA-CRON-SECRET": process.env.ORYA_CRON_SECRET }
    : undefined;
  try {
    if (typeof fetch === "function") {
      const res = await fetch(targetUrl, { headers, redirect: "manual" });
      return Boolean(res?.status);
    }
    return await fetchStatus(targetUrl, headers);
  } catch {
    return false;
  }
}

const skipWait = parseBool(process.env.DEV_ALL_SKIP_WAIT, false);
if (skipWait) {
  startDeferredServices();
} else {
  let logged = false;
  const intervalMs = Number(process.env.DEV_ALL_WAIT_INTERVAL_MS || 2000);
  const timer = setInterval(async () => {
    const ready = await checkServerReady();
    if (ready) {
      clearInterval(timer);
      startDeferredServices();
    } else if (!logged) {
      console.log("[dev-all] Waiting for server before starting cron/worker...");
      logged = true;
    }
  }, intervalMs);
}

process.on("SIGINT", () => {
  console.log("\n[dev-all] Stopping...");
  for (const child of children) {
    if (!child.killed) child.kill("SIGINT");
  }
  process.exit(0);
});
