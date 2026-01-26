// Run the local dev server plus all cron loops in one command.
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const repoRoot = path.resolve(__dirname, "..");

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

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const stripeCmd = process.platform === "win32" ? "stripe.exe" : "stripe";
const redisCmd = process.platform === "win32" ? "redis-server.exe" : "redis-server";

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

function maybeKillPid(pid, patterns) {
  const command = getCommandForPid(pid);
  if (!command) return false;
  const matchesRepo = command.includes(repoRoot);
  const matchesPattern = patterns.some((pattern) => command.includes(pattern));
  if (!matchesRepo || !matchesPattern) return false;
  try {
    process.kill(pid, "SIGKILL");
    console.log(`[dev-all] Killed PID ${pid} (${command.trim()}).`);
    return true;
  } catch (err) {
    console.log(`[dev-all] Failed to kill PID ${pid}: ${err?.message || err}`);
    return false;
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

function cleanupNextDevLockIfIdle() {
  const lockPath = path.join(repoRoot, ".next", "dev", "lock");
  if (!fs.existsSync(lockPath)) return;
  const psOutput = runCmd("ps -ax -o pid=,command=");
  const hasNextDev = psOutput
    .split("\n")
    .some(
      (line) =>
        line.includes("next dev") ||
        (line.includes("node_modules/.bin/next") && line.includes(repoRoot)),
    );
  if (!hasNextDev) {
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

cleanupPort(3000, ["next dev", "node_modules/.bin/next"]);
cleanupPort(3001, ["next dev", "node_modules/.bin/next"]);
cleanupPort(4001, ["chat-ws-server.js"]);
cleanupNextDevLockIfIdle();

const baseNextPort = Number(process.env.NEXT_PORT || process.env.PORT || 3000);
const nextPort = findAvailablePort(baseNextPort, 5);
if (nextPort !== baseNextPort) {
  console.log(`[dev-all] NEXT_PORT ${baseNextPort} ocupado. Usando ${nextPort}.`);
}
process.env.NEXT_PORT = String(nextPort);
process.env.PORT = String(nextPort);
if (!process.env.ORYA_BASE_URL) {
  process.env.ORYA_BASE_URL = `http://localhost:${nextPort}`;
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
if (!process.env.NEXT_PUBLIC_CHAT_WS_URL) {
  process.env.NEXT_PUBLIC_CHAT_WS_URL = `ws://localhost:${chatWsPort}`;
}

const children = [
  run("dev", npmCmd, ["run", "dev"]),
  run("cron", npmCmd, ["run", "cron:local"]),
];

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

process.on("SIGINT", () => {
  console.log("\n[dev-all] Stopping...");
  for (const child of children) {
    if (!child.killed) child.kill("SIGINT");
  }
  process.exit(0);
});
