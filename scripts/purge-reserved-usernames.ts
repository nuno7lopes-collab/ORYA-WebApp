import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
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

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

type UserRecord = { id: string; username: string | null; email: string | null };
type OrgRecord = { id: number; username: string | null };

async function clearUsernameForOwner(ownerType: "user" | "organization", ownerId: string | number) {
  await prisma.globalUsername.deleteMany({
    where: { env: APP_ENV, ownerType, ownerId: String(ownerId) },
  });
}

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");

async function loadUsers(): Promise<UserRecord[]> {
  const profiles = await prisma.profile.findMany({
    where: { env: APP_ENV, username: { not: null } },
    select: {
      id: true,
      username: true,
      users: { select: { email: true } },
    },
  });
  return profiles
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      email: profile.users?.email ?? null,
    }))
    .filter((profile) => {
      if (!isReservedUsername(profile.username)) return false;
      return !isReservedUsernameAllowed(profile.username ?? "", profile.email);
    });
}

async function loadOrganizations(): Promise<OrgRecord[]> {
  const orgs = await prisma.organization.findMany({
    where: { env: APP_ENV, username: { not: null } },
    select: { id: true, username: true },
  });
  return orgs.filter((org) => isReservedUsername(org.username));
}

async function purgeUsers(users: UserRecord[]) {
  for (const user of users) {
    console.log(`[purge] user ${user.id} @${user.username}`);
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, false);
      if (error && error.status !== 404) {
        console.warn(`[purge] auth delete failed for ${user.id}`, error);
      }
    } catch (err) {
      console.warn(`[purge] auth delete threw for ${user.id}`, err);
    }

    try {
      await prisma.profile.deleteMany({ where: { env: APP_ENV, id: user.id } });
    } catch (err) {
      console.warn(`[purge] profile delete failed for ${user.id}`, err);
    }

    try {
      await clearUsernameForOwner({ ownerType: "user", ownerId: user.id });
    } catch (err) {
      console.warn(`[purge] clear username failed for ${user.id}`, err);
    }
  }
}

async function purgeOrganizations(orgs: OrgRecord[]) {
  for (const org of orgs) {
    console.log(`[purge] organization ${org.id} @${org.username}`);
    try {
      await prisma.organization.deleteMany({ where: { env: APP_ENV, id: org.id } });
    } catch (err) {
      console.warn(`[purge] organization delete failed for ${org.id}`, err);
    }

    try {
      await clearUsernameForOwner({ ownerType: "organization", ownerId: org.id });
    } catch (err) {
      console.warn(`[purge] clear username failed for org ${org.id}`, err);
    }
  }
}

async function main() {
  const reservedSet = getReservedSet();
  const [users, organizations] = await Promise.all([loadUsers(), loadOrganizations()]);

  console.log(`[purge] reserved set size: ${reservedSet.size}`);
  console.log(`[purge] users flagged: ${users.length}`);
  console.log(`[purge] organizations flagged: ${organizations.length}`);

  if (!shouldApply) {
    console.log("[purge] dry-run mode. Re-run with --apply to delete.");
    return;
  }

  await purgeOrganizations(organizations);
  await purgeUsers(users);
}

main()
  .catch((err) => {
    console.error("[purge-reserved-usernames] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
