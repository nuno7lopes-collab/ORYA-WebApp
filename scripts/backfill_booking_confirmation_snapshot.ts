/**
 * Backfill BookingConfirmationSnapshot for bookings without confirmationSnapshot.
 *
 * Runbook:
 *   1) Dry-run first:
 *      node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --dry-run --limit=200
 *   2) Apply with a bounded limit:
 *      node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --limit=200
 *
 * Notes:
 *   - Must run before deploy if cancellation/no-show will rely on snapshots.
 *   - Idempotent: only targets bookings where confirmationSnapshot is null.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { backfillBookingConfirmationSnapshots } from "../lib/reservas/backfillConfirmationSnapshot";

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
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

async function main() {
  const summary = await backfillBookingConfirmationSnapshots(prisma, {
    dryRun,
    limit: Number.isFinite(limit) ? limit : null,
    logger: (message) => console.log(message),
  });

  if (summary.policyHintMissing > 0) {
    console.warn(
      `[booking_confirmation_backfill] WARN policy hints missing for ${summary.policyHintMissing} bookings.`,
    );
  }
  if (summary.missingPolicy > 0 || summary.missingPricing > 0 || summary.missingService > 0) {
    console.warn(
      `[booking_confirmation_backfill] WARN unresolved bookings: policy=${summary.missingPolicy} pricing=${summary.missingPricing} service=${summary.missingService}.`,
    );
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

