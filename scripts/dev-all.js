// Run the local dev server plus all cron loops in one command.
const { spawn } = require("child_process");
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

  const stripeEnv = { ...process.env };
  if (!stripeEnv.STRIPE_API_KEY && stripeEnv.STRIPE_SECRET_KEY) {
    stripeEnv.STRIPE_API_KEY = stripeEnv.STRIPE_SECRET_KEY;
  }

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
