import "./load-env.js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const APP_ENV_RAW = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "prod";
const APP_ENV = APP_ENV_RAW.toLowerCase() === "test" ? "test" : "prod";
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma connection.");
}

function stripUnsupportedParams(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["options"];
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

function resolvePgSsl(url: string): { ssl: false | { rejectUnauthorized: false } | undefined; connectionString: string } {
  const sanitized = stripUnsupportedParams(url);
  let sslMode: string | null = null;
  let host = "";
  try {
    const parsed = new URL(sanitized);
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
    return { ssl: false, connectionString: stripSslOptions(sanitized) };
  }

  const allowSelfSigned =
    process.env.PGSSL_ALLOW_SELF_SIGNED === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (process.env.NODE_ENV !== "production" || allowSelfSigned) {
    return { ssl: { rejectUnauthorized: false }, connectionString: stripSslOptions(sanitized) };
  }

  return { ssl: undefined, connectionString: sanitized };
}

const pg = resolvePgSsl(connectionString);
const pool = new Pool({
  connectionString: pg.connectionString,
  ssl: pg.ssl,
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [APP_ENV]).catch(() => {});
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function main() {
  const bookingResult = await prisma.$executeRawUnsafe(`
    UPDATE app_v3.agenda_items ai
    SET resource_id = b.resource_id,
        professional_id = b.professional_id,
        court_id = b.court_id
    FROM app_v3.bookings b
    WHERE ai.source_type = 'BOOKING'
      AND ai.source_id = b.id::text
      AND ai.organization_id = b.organization_id
      AND (ai.resource_id IS NULL OR ai.professional_id IS NULL OR ai.court_id IS NULL);
  `);

  const classSessionResult = await prisma.$executeRawUnsafe(`
    UPDATE app_v3.agenda_items ai
    SET professional_id = cs.professional_id,
        court_id = cs.court_id
    FROM app_v3.class_sessions cs
    WHERE ai.source_type = 'CLASS_SESSION'
      AND ai.source_id = cs.id::text
      AND ai.organization_id = cs.organization_id
      AND (ai.professional_id IS NULL OR ai.court_id IS NULL);
  `);

  // eslint-disable-next-line no-console
  console.log("agenda_items booking backfill result:", bookingResult);
  // eslint-disable-next-line no-console
  console.log("agenda_items class_sessions backfill result:", classSessionResult);
}

main()
  .catch((err) => {
    console.error("backfill_agenda_scopes failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
