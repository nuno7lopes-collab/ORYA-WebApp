import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { isReservedUsername, isReservedUsernameAllowed, getReservedSet } from "../lib/reservedUsernames";

const ROOT = process.cwd();
const envFiles = [".env.local", ".env"];
envFiles.forEach((file) => {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full });
  }
});

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
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type UserAudit = {
  id: string;
  username: string;
  fullName: string | null;
  status: string | null;
  eventsOwned: number;
  ticketsOwned: number;
  bookings: number;
};

type OrgAudit = {
  id: number;
  username: string;
  name: string | null;
  status: string | null;
  events: number;
  services: number;
  bookings: number;
};

async function auditUsers(): Promise<UserAudit[]> {
  const profiles = await prisma.profile.findMany({
    where: { env: APP_ENV, username: { not: null } },
    select: {
      id: true,
      username: true,
      fullName: true,
      status: true,
      users: { select: { email: true } },
    },
  });

  const reserved = profiles.filter((profile) => {
    if (!isReservedUsername(profile.username)) return false;
    return !isReservedUsernameAllowed(profile.username ?? "", profile.users?.email ?? null);
  });
  const results: UserAudit[] = [];

  for (const profile of reserved) {
    const [eventsOwned, ticketsOwned, bookings] = await Promise.all([
      prisma.event.count({ where: { env: APP_ENV, ownerUserId: profile.id } }),
      prisma.ticket.count({ where: { env: APP_ENV, ownerUserId: profile.id } }),
      prisma.booking.count({ where: { env: APP_ENV, userId: profile.id } }),
    ]);
    results.push({
      id: profile.id,
      username: profile.username!,
      fullName: profile.fullName,
      status: profile.status ?? null,
      eventsOwned,
      ticketsOwned,
      bookings,
    });
  }

  return results;
}

async function auditOrganizations(): Promise<OrgAudit[]> {
  const organizations = await prisma.organization.findMany({
    where: { env: APP_ENV, username: { not: null } },
    select: { id: true, username: true, publicName: true, businessName: true, status: true },
  });

  const reserved = organizations.filter((org) => isReservedUsername(org.username));
  const results: OrgAudit[] = [];

  for (const org of reserved) {
    const [events, services, bookings] = await Promise.all([
      prisma.event.count({ where: { env: APP_ENV, organizationId: org.id } }),
      prisma.service.count({ where: { env: APP_ENV, organizationId: org.id } }),
      prisma.booking.count({ where: { env: APP_ENV, organizationId: org.id } }),
    ]);
    results.push({
      id: org.id,
      username: org.username!,
      name: org.publicName || org.businessName,
      status: org.status ?? null,
      events,
      services,
      bookings,
    });
  }

  return results;
}

async function main() {
  const reservedSet = getReservedSet();
  const [users, organizations] = await Promise.all([auditUsers(), auditOrganizations()]);
  const output = {
    generatedAt: new Date().toISOString(),
    env: APP_ENV,
    reservedCount: reservedSet.size,
    users,
    organizations,
    totals: {
      users: users.length,
      organizations: organizations.length,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((err) => {
    console.error("[audit-reserved-usernames] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
