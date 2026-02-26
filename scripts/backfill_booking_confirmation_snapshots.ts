import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { backfillBookingConfirmationSnapshots } from "../lib/reservas/backfillConfirmationSnapshot";

type Args = {
  execute: boolean;
  limit: number;
  afterId: number | null;
  maxBatches: number;
};

type Aggregate = {
  batchesExecuted: number;
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  missingPolicy: number;
  missingPricing: number;
  missingService: number;
  policyHintMissing: number;
  byStatus: Record<string, number>;
};

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readNumericArg(argv: string[], prefix: string) {
  const raw = argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return null;
  const parsed = Number(raw.slice(prefix.length));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Argumento inválido: ${raw}`);
  }
  return Math.floor(parsed);
}

function clampPositive(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.max(1, Math.floor(value)), max);
}

function parseArgs(argv: string[]): Args {
  const execute = argv.includes("--execute");
  const limitArg = readNumericArg(argv, "--limit=");
  const afterIdArg = readNumericArg(argv, "--after-id=");
  const maxBatchesArg = readNumericArg(argv, "--max-batches=");

  return {
    execute,
    limit: clampPositive(limitArg ?? 200, 200, 1000),
    afterId: afterIdArg && afterIdArg > 0 ? afterIdArg : null,
    maxBatches: clampPositive(maxBatchesArg ?? 20, 20, 500),
  };
}

function mergeByStatus(target: Record<string, number>, source: Record<string, number>) {
  for (const [status, value] of Object.entries(source)) {
    target[status] = (target[status] ?? 0) + (Number.isFinite(value) ? value : 0);
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL ou DIRECT_URL no ambiente.");
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

  const aggregate: Aggregate = {
    batchesExecuted: 0,
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    missingPolicy: 0,
    missingPricing: 0,
    missingService: 0,
    policyHintMissing: 0,
    byStatus: {},
  };

  let afterId = args.afterId;
  let reachedEnd = false;

  try {
    for (let batch = 1; batch <= args.maxBatches; batch += 1) {
      console.log(
        `[booking_confirmation_backfill] batch=${batch} mode=${args.execute ? "execute" : "dry-run"} afterId=${afterId ?? "none"} limit=${args.limit}`,
      );

      const summary = await backfillBookingConfirmationSnapshots(prisma as any, {
        dryRun: !args.execute,
        limit: args.limit,
        afterId,
        logger: (message) => console.log(message),
      });

      aggregate.batchesExecuted += 1;
      aggregate.scanned += summary.scanned;
      aggregate.updated += summary.updated;
      aggregate.skipped += summary.skipped;
      aggregate.errors += summary.errors;
      aggregate.missingPolicy += summary.missingPolicy;
      aggregate.missingPricing += summary.missingPricing;
      aggregate.missingService += summary.missingService;
      aggregate.policyHintMissing += summary.policyHintMissing;
      mergeByStatus(aggregate.byStatus, summary.byStatus);

      if (!summary.lastId || summary.scanned < summary.limit) {
        reachedEnd = true;
        afterId = summary.lastId;
        break;
      }
      afterId = summary.lastId;
    }

    console.log(
      JSON.stringify(
        {
          mode: args.execute ? "execute" : "dry-run",
          limit: args.limit,
          maxBatches: args.maxBatches,
          reachedEnd,
          nextAfterId: afterId,
          ...aggregate,
        },
        null,
        2,
      ),
    );

    if (aggregate.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[booking_confirmation_backfill] failed", error);
  process.exit(1);
});
