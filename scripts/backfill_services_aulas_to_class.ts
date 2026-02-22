/**
 * Backfill GENERAL services tagged as AULAS to CLASS when recurring or clearly class-like.
 *
 * Usage:
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_services_aulas_to_class.ts --dry-run --limit=200
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_services_aulas_to_class.ts --apply --limit=200 --cursor=0
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { backfillServicesAulasToClass } from "../lib/reservas/backfillServicesAulasToClass";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma connection.");
}

function stripSslOptions(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse errors, return raw
  }
  return raw;
}

function resolvePoolConfig(raw: string) {
  let sslMode: string | null = null;
  let host = "";
  try {
    const parsed = new URL(raw);
    sslMode = parsed.searchParams.get("sslmode");
    host = parsed.hostname;
  } catch {
    // ignore parse errors
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const forceDisable =
    process.env.PGSSL_DISABLE === "true" ||
    process.env.PGSSLMODE === "disable" ||
    sslMode === "disable" ||
    isLocalHost;
  if (forceDisable) {
    return { connectionString: stripSslOptions(raw), ssl: false as const };
  }

  const allowSelfSigned =
    process.env.PGSSL_ALLOW_SELF_SIGNED === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (process.env.NODE_ENV !== "production" || allowSelfSigned) {
    return { connectionString: stripSslOptions(raw), ssl: { rejectUnauthorized: false } };
  }

  return { connectionString: raw, ssl: undefined };
}

const args = process.argv.slice(2);
const hasDryRunFlag = args.includes("--dry-run");
const hasApplyFlag = args.includes("--apply");
if (hasDryRunFlag && hasApplyFlag) {
  throw new Error("Use apenas um modo: --dry-run ou --apply.");
}

const dryRun = hasApplyFlag ? false : true;
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const cursorArg = args.find((arg) => arg.startsWith("--cursor="));
const batchesArg = args.find((arg) => arg.startsWith("--batches="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
const initialCursor = cursorArg ? Number(cursorArg.split("=")[1]) : null;
const batches = batchesArg ? Number(batchesArg.split("=")[1]) : 1;

const poolConfig = resolvePoolConfig(connectionString);
const pool = new Pool({
  connectionString: poolConfig.connectionString,
  ssl: poolConfig.ssl,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  let cursor = Number.isFinite(initialCursor) ? Number(initialCursor) : null;
  const maxBatches = Number.isFinite(batches) ? Math.max(1, Math.floor(batches)) : 1;

  const totals = {
    scanned: 0,
    eligible: 0,
    converted: 0,
    skipped: 0,
    manualReview: 0,
    recurringConverted: 0,
    clearlyClassConverted: 0,
    errors: 0,
  };

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const summary = await backfillServicesAulasToClass(prisma, {
      dryRun,
      limit,
      afterId: cursor,
      logger: (message) => console.log(message),
    });

    totals.scanned += summary.scanned;
    totals.eligible += summary.eligible;
    totals.converted += summary.converted;
    totals.skipped += summary.skipped;
    totals.manualReview += summary.manualReview;
    totals.recurringConverted += summary.recurringConverted;
    totals.clearlyClassConverted += summary.clearlyClassConverted;
    totals.errors += summary.errors;

    cursor = summary.lastId ?? cursor;

    console.log(
      `[services_aulas_backfill] CHECKPOINT batch=${batch}/${maxBatches} lastId=${cursor ?? "none"} scanned=${summary.scanned} converted=${summary.converted}`,
    );

    if (summary.scanned < summary.limit) {
      console.log("[services_aulas_backfill] No more service rows to process in this run.");
      break;
    }
  }

  console.log("[services_aulas_backfill] Totals:");
  console.log(JSON.stringify({ dryRun, nextCursor: cursor, ...totals }, null, 2));
}

main()
  .catch((err) => {
    console.error("[services_aulas_backfill] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
