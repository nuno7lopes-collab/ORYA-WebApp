#!/usr/bin/env node
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
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
  console.error("Falta DATABASE_URL (ou DIRECT_URL)."
  );
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

const DEFAULT_ADDRESSES = [
  {
    label: "Av. da Liberdade 1250-140, Lisboa",
    city: "Lisboa",
    region: "Lisboa",
    country: "Portugal",
    lat: 38.721646,
    lng: -9.146308,
  },
  {
    label: "Praca da Ribeira, 4050-513 Porto",
    city: "Porto",
    region: "Porto",
    country: "Portugal",
    lat: 41.140301,
    lng: -8.611,
  },
  {
    label: "Largo do Paço, 4704-524 Braga",
    city: "Braga",
    region: "Braga",
    country: "Portugal",
    lat: 41.5518,
    lng: -8.4274,
  },
  {
    label: "Rua da Sofia, 3000-389 Coimbra",
    city: "Coimbra",
    region: "Coimbra",
    country: "Portugal",
    lat: 40.2057,
    lng: -8.4122,
  },
  {
    label: "Marina de Lagos, 8600-315 Lagos",
    city: "Lagos",
    region: "Algarve",
    country: "Portugal",
    lat: 37.1087,
    lng: -8.6695,
  },
  {
    label: "Praca do Giraldo, 7000-508 Evora",
    city: "Evora",
    region: "Alentejo",
    country: "Portugal",
    lat: 38.5712,
    lng: -7.9079,
  },
];

function buildCanonical(entry) {
  return {
    label: entry.label,
    addressLine1: entry.label,
    city: entry.city,
    region: entry.region,
    country: entry.country,
  };
}

function hashAddress(canonical, lat, lng) {
  const payload = `${JSON.stringify(canonical)}:${lat}:${lng}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function main() {
  const created = [];
  for (const entry of DEFAULT_ADDRESSES) {
    const canonical = buildCanonical(entry);
    const addressHash = hashAddress(canonical, entry.lat, entry.lng);
    const existing = await prisma.address.findUnique({ where: { addressHash } });
    const address = existing
      ? await prisma.address.update({
          where: { id: existing.id },
          data: {
            env: seedEnv,
            formattedAddress: entry.label,
            canonical,
            latitude: entry.lat,
            longitude: entry.lng,
            sourceProvider: "MANUAL",
            confidenceScore: 20,
            validationStatus: "RAW",
          },
        })
      : await prisma.address.create({
          data: {
            env: seedEnv,
            formattedAddress: entry.label,
            canonical,
            latitude: entry.lat,
            longitude: entry.lng,
            sourceProvider: "MANUAL",
            confidenceScore: 20,
            validationStatus: "RAW",
            addressHash,
          },
        });
    created.push({ id: address.id, label: entry.label });
  }

  const ids = created.map((item) => item.id).join(",");
  console.log("[seed-addresses] Created/updated:", created);
  console.log("[seed-addresses] SEED_ADDRESS_IDS=", ids);
}

main()
  .catch((err) => {
    console.error("[seed-addresses] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
