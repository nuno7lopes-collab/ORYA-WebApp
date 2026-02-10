/**
 * Audit public event visibility/completeness across the repo.
 *
 * Usage:
 *   node scripts/run-ts.cjs scripts/audit_public_events.ts
 *
 * Optional:
 *   AUDIT_LIMIT=1000
 */
import fs from "fs";
import path from "path";
import { EventStatus, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PUBLIC_EVENT_STATUSES, PUBLIC_EVENT_DISCOVER_STATUSES } from "../domain/events/publicStatus";
import { resolveEventLocation } from "../lib/location/eventLocation";

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

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL no ambiente.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const AUDIT_LIMIT = (() => {
  const raw = Number(process.env.AUDIT_LIMIT ?? 2000);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 10000) : 2000;
})();

const isEventComplete = (input: {
  title?: string | null;
  startsAt?: Date | string | null;
  location?: { formattedAddress?: string | null; city?: string | null } | null;
}) => {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return false;
  const start =
    input.startsAt instanceof Date
      ? input.startsAt
      : input.startsAt
        ? new Date(input.startsAt)
        : null;
  if (!start || Number.isNaN(start.getTime())) return false;
  const location = input.location ?? null;
  const locationLabel =
    (typeof location?.formattedAddress === "string" ? location?.formattedAddress.trim() : "") ||
    (typeof location?.city === "string" ? location?.city.trim() : "");
  if (!locationLabel) return false;
  return true;
};

async function main() {
  const publicEvents = await prisma.event.findMany({
    where: { status: { in: PUBLIC_EVENT_STATUSES }, isDeleted: false },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      status: true,
      organizationId: true,
      organization: { select: { status: true } },
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
    },
    take: AUDIT_LIMIT,
  });

  const incompletePublic: Array<{ id: number; slug: string; status: string; reason: string }> = [];
  const orgInactivePublic: Array<{ id: number; slug: string; status: string; orgStatus: string | null }> = [];

  for (const ev of publicEvents) {
    const location = resolveEventLocation({ addressRef: ev.addressRef ?? null });
    const complete = isEventComplete({
      title: ev.title,
      startsAt: ev.startsAt,
      location: { formattedAddress: location.formattedAddress, city: location.city },
    });
    if (!complete) {
      incompletePublic.push({
        id: ev.id,
        slug: ev.slug,
        status: ev.status,
        reason: "missing title/startsAt/location",
      });
    }
    if (ev.organizationId && ev.organization && ev.organization.status !== "ACTIVE") {
      orgInactivePublic.push({
        id: ev.id,
        slug: ev.slug,
        status: ev.status,
        orgStatus: ev.organization.status ?? null,
      });
    }
  }

  const badSearchIndex = await prisma.searchIndexItem.findMany({
    where: {
      sourceType: "EVENT",
      visibility: "PUBLIC",
      status: { notIn: PUBLIC_EVENT_DISCOVER_STATUSES as EventStatus[] },
    },
    select: { id: true, sourceId: true, status: true, visibility: true },
  });

  const statusCounts = await prisma.event.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log(
    JSON.stringify(
      {
        totalPublicEvents: publicEvents.length,
        incompletePublicEvents: incompletePublic.length,
        orgInactivePublicEvents: orgInactivePublic.length,
        badSearchIndexPublic: badSearchIndex.length,
        statusCounts,
        samples: {
          incompletePublicEvents: incompletePublic.slice(0, 10),
          orgInactivePublicEvents: orgInactivePublic.slice(0, 10),
          badSearchIndexPublic: badSearchIndex.slice(0, 10),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("[audit_public_events] Erro:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
