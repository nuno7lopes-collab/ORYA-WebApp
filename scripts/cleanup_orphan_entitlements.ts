/**
 * Cleanup entitlements without any owner linkage.
 *
 * Usage:
 *   node scripts/run-ts.cjs scripts/cleanup_orphan_entitlements.ts
 *
 * Optional:
 *   DRY_RUN=true
 *   SAMPLE_LIMIT=20
 */
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

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
  throw new Error("Falta DATABASE_URL (ou DIRECT_URL) no ambiente.");
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

const DRY_RUN = process.env.DRY_RUN === "true";
const SAMPLE_LIMIT = (() => {
  const raw = Number(process.env.SAMPLE_LIMIT ?? 20);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 100) : 20;
})();

async function main() {
  const whereSql = Prisma.sql`
    WHERE owner_user_id IS NULL
      AND owner_identity_id IS NULL
      AND (owner_key IS NULL OR owner_key = 'unknown')
  `;

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM app_v3.entitlements
    ${whereSql}
  `;
  const total = Number(countRows?.[0]?.count ?? 0);

  const sample = await prisma.$queryRaw<
    Array<{ id: string; owner_key: string | null; purchase_id: string; event_id: number | null; created_at: Date }>
  >`
    SELECT id, owner_key, purchase_id, event_id, created_at
    FROM app_v3.entitlements
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ${SAMPLE_LIMIT}
  `;

  console.log(`[cleanup-orphan-entitlements] Found ${total} orphan entitlements.`);
  if (sample.length > 0) {
    console.log(`[cleanup-orphan-entitlements] Sample (max ${SAMPLE_LIMIT}):`);
    console.log(sample);
  }

  if (DRY_RUN) {
    console.log("[cleanup-orphan-entitlements] DRY_RUN enabled, no deletions.");
    return;
  }

  if (total === 0) {
    console.log("[cleanup-orphan-entitlements] Nothing to delete.");
    return;
  }

  const deleted = await prisma.$executeRaw`
    DELETE FROM app_v3.entitlements
    ${whereSql}
  `;
  console.log(`[cleanup-orphan-entitlements] Deleted ${deleted} entitlements.`);
}

main()
  .catch((err) => {
    console.error("[cleanup-orphan-entitlements] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
