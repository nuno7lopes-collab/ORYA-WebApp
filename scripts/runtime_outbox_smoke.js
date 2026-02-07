#!/usr/bin/env node

require("./load-env");

const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function resolveDbUrl() {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("options");
    return parsed.toString();
  } catch {
    return raw;
  }
}

const BASE_URL =
  process.env.RUNTIME_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

const SECRET = process.env.ORYA_CRON_SECRET;
if (!SECRET) {
  console.error("[runtime-outbox-smoke] ORYA_CRON_SECRET em falta. Verifica .env/.env.local.");
  process.exit(1);
}

const RESOLVED_ENV = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "prod").toLowerCase();

const dbUrl = resolveDbUrl();
if (!dbUrl) {
  console.error("[runtime-outbox-smoke] Falta DATABASE_URL (ou DIRECT_URL) no ambiente.");
  process.exit(1);
}

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [RESOLVED_ENV]).catch(() => {});
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function callWorker(label) {
  const url = `${BASE_URL}/api/internal/worker/operations`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-ORYA-CRON-SECRET": SECRET,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { label, status: res.status, body };
}

function summarizeWorker(response) {
  const data = response?.body?.data ?? null;
  return {
    status: response.status,
    processed: typeof data?.processed === "number" ? data.processed : null,
    backlogCount: typeof data?.stats?.backlogCount === "number" ? data.stats.backlogCount : null,
    durationMs: typeof data?.stats?.durationMs === "number" ? data.stats.durationMs : null,
  };
}

async function main() {
  const eventId = crypto.randomUUID();
  const eventType = process.env.OUTBOX_SMOKE_EVENT_TYPE || "diagnostic.runtime_smoke";
  const dedupeKey = `${eventType}:${eventId}`;
  const payload = {
    source: "runtime_validation",
    ts: new Date().toISOString(),
  };

  await prisma.outboxEvent.create({
    data: {
      env: RESOLVED_ENV,
      eventId,
      eventType,
      dedupeKey,
      payload,
      causationId: eventId,
      correlationId: eventId,
    },
  });

  const first = await callWorker("publish");
  const second = await callWorker("consume");

  const fetchOutbox = () =>
    prisma.outboxEvent.findUnique({
      where: { eventId },
      select: {
        publishedAt: true,
        nextAttemptAt: true,
        deadLetteredAt: true,
        attempts: true,
        claimedAt: true,
        processingToken: true,
      },
    });

  const fetchOperation = () =>
    prisma.operation.findUnique({
      where: { dedupeKey: `outbox:${eventId}` },
      select: {
        status: true,
        attempts: true,
        updatedAt: true,
        lastError: true,
      },
    });

  let outbox = await fetchOutbox();
  let operation = await fetchOperation();
  let fallbackUsed = false;
  let fallbackRun = null;

  if (!operation || !outbox?.publishedAt) {
    fallbackUsed = true;
    try {
      await prisma.operation.create({
        data: {
          env: RESOLVED_ENV,
          operationType: "OUTBOX_EVENT",
          dedupeKey: `outbox:${eventId}`,
          status: "PENDING",
          payload: {
            eventId,
            eventType,
            payload,
            causationId: eventId,
            correlationId: eventId,
          },
        },
      });
    } catch {
      // ignore dedupe conflicts
    }
    fallbackRun = await callWorker("fallback-consume");
    outbox = await fetchOutbox();
    operation = await fetchOperation();
  }

  const result = {
    eventId,
    eventType,
    dedupeKey,
    env: RESOLVED_ENV,
    baseUrl: BASE_URL,
    workerFirst: summarizeWorker(first),
    workerSecond: summarizeWorker(second),
    fallbackUsed,
    fallbackRun: fallbackRun ? summarizeWorker(fallbackRun) : null,
    outbox,
    operation,
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("[runtime-outbox-smoke] Erro:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
