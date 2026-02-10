#!/usr/bin/env node
/**
 * Corrige eventos com ends_at <= starts_at, forçando ends_at = starts_at + 5h.
 *
 * Uso:
 *   node scripts/fix_event_ends_at.js
 */

const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("./load-env");

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

const dbUrl = resolveDbUrl();
if (!dbUrl) {
  console.error("Falta DATABASE_URL (ou DIRECT_URL) no ambiente.");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.events
    SET ends_at = starts_at + interval '5 hours'
    WHERE ends_at IS NULL OR ends_at <= starts_at
  `);

  console.log(`[fix-event-ends-at] Updated ${updated} events.`);
}

main()
  .catch((err) => {
    console.error("[fix-event-ends-at] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
