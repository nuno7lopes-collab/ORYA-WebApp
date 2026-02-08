#!/usr/bin/env node
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient, SourceType, SearchIndexVisibility, EventPricingMode } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Falta DATABASE_URL (ou DIRECT_URL)." );
  process.exit(1);
}

const seedEnvRaw = (process.env.SEED_ENV || process.env.APP_ENV || "prod").toLowerCase();
const seedEnv = seedEnvRaw === "test" ? "test" : "prod";

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [seedEnv]).catch(() => {});
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

function deriveIsFreeEvent(pricingMode, ticketPrices) {
  const mode = pricingMode || EventPricingMode.STANDARD;
  if (mode === EventPricingMode.FREE_ONLY) return true;
  const prices = (ticketPrices || []).map((p) => Number(p || 0));
  if (prices.length === 0) return false;
  const hasZero = prices.some((p) => p === 0);
  const hasPaid = prices.some((p) => p > 0);
  return hasZero && !hasPaid;
}

function coerceNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && typeof value.toNumber === "function") {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
}

function resolveVisibility({ status, isDeleted, orgStatus, orgId }) {
  const isPublicStatus = status === "PUBLISHED" || status === "DATE_CHANGED";
  if (!orgId) return SearchIndexVisibility.HIDDEN;
  if (!isPublicStatus) return SearchIndexVisibility.HIDDEN;
  if (isDeleted) return SearchIndexVisibility.HIDDEN;
  if (orgStatus !== "ACTIVE") return SearchIndexVisibility.HIDDEN;
  return SearchIndexVisibility.PUBLIC;
}

async function main() {
  console.log("[rebuild-search-index] Clearing EVENT items...");
  await prisma.searchIndexItem.deleteMany({ where: { sourceType: SourceType.EVENT } });

  const events = await prisma.event.findMany({
    where: { env: seedEnv },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      status: true,
      templateType: true,
      pricingMode: true,
      isDeleted: true,
      coverImageUrl: true,
      addressId: true,
      organizationId: true,
      organization: { select: { status: true, publicName: true, username: true } },
      ticketTypes: { select: { price: true } },
    },
  });

  console.log(`[rebuild-search-index] Rebuilding ${events.length} events...`);

  for (const event of events) {
    if (!event.organizationId) {
      continue;
    }
    const ticketPrices = event.ticketTypes.map((t) => coerceNumber(t.price));
    const isGratis = deriveIsFreeEvent(event.pricingMode, ticketPrices);
    const numericPrices = ticketPrices.filter((p) => typeof p === "number");
    const priceFromCents = isGratis ? 0 : numericPrices.length > 0 ? Math.min(...numericPrices) : null;

    const visibility = resolveVisibility({
      status: event.status,
      isDeleted: event.isDeleted,
      orgStatus: event.organization?.status ?? null,
      orgId: event.organizationId,
    });

    const lastEventId = crypto.randomUUID();

    await prisma.searchIndexItem.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: event.organizationId,
          sourceType: SourceType.EVENT,
          sourceId: String(event.id),
        },
      },
      update: {
        slug: event.slug,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt || event.startsAt,
        templateType: event.templateType,
        pricingMode: event.pricingMode,
        isGratis,
        priceFromCents,
        coverImageUrl: event.coverImageUrl,
        hostName: event.organization?.publicName ?? null,
        hostUsername: event.organization?.username ?? null,
        addressId: event.addressId ?? null,
        status: event.status,
        visibility,
        lastEventId,
        updatedAt: new Date(),
        env: seedEnv,
      },
      create: {
        env: seedEnv,
        organizationId: event.organizationId,
        sourceType: SourceType.EVENT,
        sourceId: String(event.id),
        slug: event.slug,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt || event.startsAt,
        templateType: event.templateType,
        pricingMode: event.pricingMode,
        isGratis,
        priceFromCents,
        coverImageUrl: event.coverImageUrl,
        hostName: event.organization?.publicName ?? null,
        hostUsername: event.organization?.username ?? null,
        addressId: event.addressId ?? null,
        status: event.status,
        visibility,
        lastEventId,
        updatedAt: new Date(),
      },
    });
  }

  console.log("[rebuild-search-index] Done.");
}

main()
  .catch((err) => {
    console.error("[rebuild-search-index] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
