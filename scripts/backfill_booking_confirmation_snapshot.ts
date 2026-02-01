/**
 * Backfill BookingConfirmationSnapshot for bookings without confirmationSnapshot.
 *
 * Runbook:
 *   1) Dry-run first:
 *      node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --dry-run --limit=200
 *   2) Apply with a bounded limit:
 *      node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --limit=200
 *   3) Process in batches (checkpoint by id) + verify remaining:
 *      node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --batch-size=200 --batches=5 --verify
 *
 * Notes:
 *   - Must run before deploy if cancellation/no-show will rely on snapshots.
 *   - Idempotent: only targets bookings where confirmationSnapshot is null.
 *   - Use --after-id=<id> to resume from a checkpoint.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  BACKFILL_STATUSES,
  backfillBookingConfirmationSnapshots,
} from "../lib/reservas/backfillConfirmationSnapshot";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma connection.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const batchSizeArg = args.find((arg) => arg.startsWith("--batch-size="));
const batchesArg = args.find((arg) => arg.startsWith("--batches="));
const afterIdArg = args.find((arg) => arg.startsWith("--after-id="));
const verify = args.includes("--verify");

const limit = limitArg ? Number(limitArg.split("=")[1]) : null;
const batchSize = batchSizeArg
  ? Number(batchSizeArg.split("=")[1])
  : Number.isFinite(limit)
    ? Number(limit)
    : null;
const maxBatches = batchesArg ? Number(batchesArg.split("=")[1]) : 1;
const afterId = afterIdArg ? Number(afterIdArg.split("=")[1]) : null;

async function main() {
  const logger = (message: string) => console.log(message);
  let cursor = Number.isFinite(afterId) ? Number(afterId) : null;
  let batch = 0;
  const totals = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    missingPolicy: 0,
    missingPricing: 0,
    missingService: 0,
    policyHintMissing: 0,
  };

  const resolvedBatchSize = Number.isFinite(batchSize) ? Number(batchSize) : 200;
  const resolvedMaxBatches = Number.isFinite(maxBatches) ? Math.max(1, Math.floor(maxBatches)) : 1;

  while (batch < resolvedMaxBatches) {
    batch += 1;
    const summary = await backfillBookingConfirmationSnapshots(prisma, {
      dryRun,
      limit: resolvedBatchSize,
      afterId: cursor,
      logger,
    });

    totals.scanned += summary.scanned;
    totals.updated += summary.updated;
    totals.skipped += summary.skipped;
    totals.errors += summary.errors;
    totals.missingPolicy += summary.missingPolicy;
    totals.missingPricing += summary.missingPricing;
    totals.missingService += summary.missingService;
    totals.policyHintMissing += summary.policyHintMissing;

    cursor = summary.lastId ?? cursor;
    logger(
      `[booking_confirmation_backfill] CHECKPOINT batch=${batch}/${resolvedMaxBatches} lastId=${cursor ?? "none"} scanned=${summary.scanned} updated=${summary.updated}.`,
    );

    if (summary.scanned < resolvedBatchSize) {
      logger("[booking_confirmation_backfill] No more bookings to process in this run.");
      break;
    }
  }

  logger("[booking_confirmation_backfill] Totals:");
  logger(
    `- scanned=${totals.scanned} updated=${totals.updated} skipped=${totals.skipped} errors=${totals.errors}`,
  );
  logger(
    `- missingPolicy=${totals.missingPolicy} missingPricing=${totals.missingPricing} missingService=${totals.missingService}`,
  );
  logger(`- policyHintMissing=${totals.policyHintMissing}`);

  if (totals.policyHintMissing > 0) {
    console.warn(
      `[booking_confirmation_backfill] WARN policy hints missing for ${totals.policyHintMissing} bookings.`,
    );
  }
  if (totals.missingPolicy > 0 || totals.missingPricing > 0 || totals.missingService > 0) {
    console.warn(
      `[booking_confirmation_backfill] WARN unresolved bookings: policy=${totals.missingPolicy} pricing=${totals.missingPricing} service=${totals.missingService}.`,
    );
  }

  if (verify) {
    const remaining = await prisma.booking.count({
      where: {
        status: { in: BACKFILL_STATUSES },
        confirmationSnapshot: { equals: Prisma.DbNull },
      },
    });
    logger(`[booking_confirmation_backfill] VERIFY remaining_without_snapshot=${remaining}.`);
  }
}

main()
  .catch((err) => {
    console.error("[booking_confirmation_backfill] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
