/**
 * Backfill EventAccessPolicy for events without a policy.
 * Usage:
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts [--dry-run] [--limit=100]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createEventAccessPolicyVersion } from "../lib/checkin/accessPolicy";
import { resolveEventAccessPolicyInput } from "../lib/events/accessPolicy";

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
  const events = await prisma.event.findMany({
    where: {
      isDeleted: false,
      accessPolicies: { none: {} },
    },
    select: {
      id: true,
      slug: true,
      templateType: true,
    },
    orderBy: { id: "asc" },
    ...(limit && Number.isFinite(limit) ? { take: Math.max(1, Math.floor(limit)) } : {}),
  });

  console.log(`[backfill_access_policy] Found ${events.length} events without access policy.`);

  let updated = 0;
  let skipped = 0;
  const modeCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let defaultModeWarnings = 0;

  for (const event of events) {
    const resolution = resolveEventAccessPolicyInput({
      accessPolicy: null,
      templateType: event.templateType ?? null,
    });

    modeCounts[resolution.mode] = (modeCounts[resolution.mode] ?? 0) + 1;
    sourceCounts[resolution.source] = (sourceCounts[resolution.source] ?? 0) + 1;
    if (resolution.source === "default") defaultModeWarnings += 1;

    if (dryRun) {
      console.log(
        `[backfill_access_policy] DRY RUN event ${event.id} (${event.slug}): mode=${resolution.mode} source=${resolution.source}`,
      );
      skipped += 1;
      continue;
    }

    try {
      await createEventAccessPolicyVersion(event.id, resolution.policyInput, prisma);
      updated += 1;
      console.log(
        `[backfill_access_policy] Created policy for event ${event.id} (${event.slug}): mode=${resolution.mode} source=${resolution.source}`,
      );
    } catch (err) {
      console.error(`[backfill_access_policy] Failed for event ${event.id} (${event.slug}):`, err);
    }
  }

  console.log("[backfill_access_policy] Summary:");
  console.log(`- total=${events.length} created=${updated} skipped=${skipped}`);
  console.log(`- byMode=${JSON.stringify(modeCounts)}`);
  console.log(`- bySource=${JSON.stringify(sourceCounts)}`);
  if (defaultModeWarnings > 0) {
    console.warn(`[backfill_access_policy] WARN default mode applied to ${defaultModeWarnings} events.`);
  }
}

main()
  .catch((err) => {
    console.error("[backfill_access_policy] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
