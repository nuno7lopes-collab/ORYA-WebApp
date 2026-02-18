const fs = require("fs");
const path = require("path");
const net = require("net");
const { createClient } = require("redis");

function loadEnv() {
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

function info(label, value) {
  console.log(`${label}: ${value}`);
}

function ok(label, value) {
  console.log(`[OK] ${label}: ${value}`);
}

function warn(label, value) {
  console.log(`[WARN] ${label}: ${value}`);
}

function fail(label, value) {
  console.log(`[FAIL] ${label}: ${value}`);
  process.exitCode = 1;
}

function maskRedisUrl(url) {
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === "rediss:" ? "6379" : "6379");
    return `${parsed.protocol}//${parsed.hostname}:${port}`;
  } catch {
    return "INVALID_REDIS_URL";
  }
}

function resolveWsUrl() {
  const envUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
  if (envUrl) return envUrl;
  const host = process.env.CHAT_WS_HOST || "127.0.0.1";
  const port = process.env.CHAT_WS_PORT || "4001";
  const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
  return `${protocol}://${host}:${port}`;
}

function parseHostPort(wsUrl) {
  try {
    const parsed = new URL(wsUrl);
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === "wss:" ? 443 : 80;
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

async function checkWsPort(wsUrl) {
  const hostPort = parseHostPort(wsUrl);
  if (!hostPort) {
    fail("WebSocket URL", "Formato inválido");
    return;
  }
  const { host, port } = hostPort;
  info("WebSocket URL", wsUrl);
  await new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1500 }, () => {
      ok("WebSocket porta", `${host}:${port} está acessível`);
      socket.end();
      resolve();
    });
    socket.on("error", (err) => {
      fail("WebSocket porta", `${host}:${port} inacessível (${err?.code || "erro"})`);
      resolve();
    });
    socket.on("timeout", () => {
      fail("WebSocket porta", `${host}:${port} timeout`);
      socket.destroy();
      resolve();
    });
  });
}

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    fail("REDIS_URL", "em falta (sem Redis não há real-time entre processos)");
    return;
  }
  info("REDIS_URL", maskRedisUrl(redisUrl));
  const client = createClient({ url: redisUrl });
  client.on("error", () => {});
  try {
    await client.connect();
    const pong = await client.ping();
    if (String(pong).toUpperCase() === "PONG") {
      ok("Redis", "ligação OK");
    } else {
      warn("Redis", `resposta inesperada (${pong})`);
    }
  } catch (err) {
    fail("Redis", `falha na ligação (${err?.message || err})`);
  } finally {
    try {
      if (client.isOpen) await client.quit();
    } catch {}
  }
}

async function run() {
  console.log("=== Chat Realtime Doctor ===");
  info("NODE_ENV", process.env.NODE_ENV || "undefined");
  await checkRedis();
  await checkWsPort(resolveWsUrl());
}

run().catch((err) => {
  fail("Diagnóstico", err?.message || err);
});
