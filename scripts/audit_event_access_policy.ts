/**
 * Auditoria de EventAccessPolicy + convites (identity match / usernames inexistentes).
 * Uso:
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts --format=json --out /tmp/audit_access_policy.json
 *   node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts --format=md --out /tmp/audit_access_policy.md --limit=200
 */
import { writeFileSync } from "fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
const formatArg = args.find((arg) => arg.startsWith("--format="));
const outArg = args.find((arg) => arg.startsWith("--out="));
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const format = (formatArg ? formatArg.split("=")[1] : "md").toLowerCase();
const outPath = outArg ? outArg.split("=")[1] : null;
const limitValue = limitArg ? Number(limitArg.split("=")[1]) : 100;
const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : null;

type InvalidPolicyRow = {
  eventId: number;
  slug: string | null;
  title: string | null;
  policyVersion: number;
  inviteTokenAllowed: boolean;
  inviteIdentityMatch: string;
  inviteTokenTtlSeconds: number | null;
  mode: string;
};

type InviteRow = {
  id: number;
  eventId: number;
  slug: string | null;
  title: string | null;
  targetIdentifier: string;
  createdAt: Date;
  inviteIdentityMatch?: string | null;
};

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asMarkdown(report: {
  generatedAt: string;
  invalidPolicies: { total: number; items: InvalidPolicyRow[] };
  invalidUsernameInvites: { total: number; items: InviteRow[] };
  mismatchedInvites: { total: number; items: InviteRow[] };
}) {
  const lines: string[] = [];
  lines.push(`# Auditoria EventAccessPolicy + Convites`);
  lines.push(`Gerado: ${report.generatedAt}`);
  lines.push("");
  lines.push(`## 1) Policies inválidas (inviteTokenAllowed + USERNAME)`);
  lines.push(`Total: ${report.invalidPolicies.total}`);
  if (report.invalidPolicies.items.length === 0) {
    lines.push("");
    lines.push("_Sem ocorrências._");
  } else {
    lines.push("");
    lines.push("| eventId | slug | title | policyVersion | mode | inviteTokenAllowed | inviteIdentityMatch | inviteTokenTtlSeconds |");
    lines.push("|---:|---|---|---:|---|---|---|---:|");
    report.invalidPolicies.items.forEach((row) => {
      lines.push(
        `| ${row.eventId} | ${row.slug ?? ""} | ${row.title ?? ""} | ${row.policyVersion} | ${row.mode} | ${row.inviteTokenAllowed} | ${row.inviteIdentityMatch} | ${row.inviteTokenTtlSeconds ?? ""} |`,
      );
    });
  }
  lines.push("");
  lines.push(`## 2) Convites por username inexistente`);
  lines.push(`Total: ${report.invalidUsernameInvites.total}`);
  if (report.invalidUsernameInvites.items.length === 0) {
    lines.push("");
    lines.push("_Sem ocorrências._");
  } else {
    lines.push("");
    lines.push("| inviteId | eventId | slug | title | targetIdentifier | createdAt |");
    lines.push("|---:|---:|---|---|---|---|");
    report.invalidUsernameInvites.items.forEach((row) => {
      lines.push(
        `| ${row.id} | ${row.eventId} | ${row.slug ?? ""} | ${row.title ?? ""} | ${row.targetIdentifier} | ${row.createdAt.toISOString()} |`,
      );
    });
  }
  lines.push("");
  lines.push(`## 3) Convites com identidade não permitida pela policy`);
  lines.push(`Total: ${report.mismatchedInvites.total}`);
  if (report.mismatchedInvites.items.length === 0) {
    lines.push("");
    lines.push("_Sem ocorrências._");
  } else {
    lines.push("");
    lines.push("| inviteId | eventId | slug | title | targetIdentifier | inviteIdentityMatch | createdAt |");
    lines.push("|---:|---:|---|---|---|---|---|");
    report.mismatchedInvites.items.forEach((row) => {
      lines.push(
        `| ${row.id} | ${row.eventId} | ${row.slug ?? ""} | ${row.title ?? ""} | ${row.targetIdentifier} | ${row.inviteIdentityMatch ?? ""} | ${row.createdAt.toISOString()} |`,
      );
    });
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const latestPolicies = await prisma.eventAccessPolicy.findMany({
    orderBy: [{ eventId: "asc" }, { policyVersion: "desc" }],
    distinct: ["eventId"],
    select: {
      eventId: true,
      policyVersion: true,
      inviteTokenAllowed: true,
      inviteIdentityMatch: true,
      inviteTokenTtlSeconds: true,
      mode: true,
    },
  });

  const invalidPolicyEvents = latestPolicies.filter(
    (policy) => policy.inviteTokenAllowed && policy.inviteIdentityMatch === "USERNAME",
  );
  const invalidEventIds = invalidPolicyEvents.map((row) => row.eventId);
  const events =
    invalidEventIds.length > 0
      ? await prisma.event.findMany({
          where: { id: { in: invalidEventIds } },
          select: { id: true, slug: true, title: true },
        })
      : [];
  const eventMap = new Map(events.map((event) => [event.id, event]));

  const invalidPolicyItems: InvalidPolicyRow[] = invalidPolicyEvents.map((row) => {
    const event = eventMap.get(row.eventId);
    return {
      eventId: row.eventId,
      slug: event?.slug ?? null,
      title: event?.title ?? null,
      policyVersion: row.policyVersion,
      inviteTokenAllowed: row.inviteTokenAllowed,
      inviteIdentityMatch: row.inviteIdentityMatch,
      inviteTokenTtlSeconds: row.inviteTokenTtlSeconds ?? null,
      mode: row.mode,
    };
  });

  const invalidUsernameInvitesTotal = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`
      SELECT COUNT(*)::bigint as count
      FROM app_v3.event_invites ei
      LEFT JOIN app_v3.profiles p ON LOWER(p.username) = LOWER(ei.target_identifier)
      WHERE ei.target_identifier NOT LIKE '%@%'
        AND p.id IS NULL
    `,
  );
  const invalidUsernameInvitesRows = await prisma.$queryRaw<InviteRow[]>(
    Prisma.sql`
      SELECT ei.id, ei.event_id as "eventId", e.slug, e.title, ei.target_identifier as "targetIdentifier", ei.created_at as "createdAt"
      FROM app_v3.event_invites ei
      JOIN app_v3.events e ON e.id = ei.event_id
      LEFT JOIN app_v3.profiles p ON LOWER(p.username) = LOWER(ei.target_identifier)
      WHERE ei.target_identifier NOT LIKE '%@%'
        AND p.id IS NULL
      ORDER BY ei.created_at DESC
      ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}
    `,
  );

  const mismatchedInvitesTotal = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`
      WITH latest_policy AS (
        SELECT DISTINCT ON (event_id) event_id, invite_identity_match
        FROM app_v3.event_access_policies
        ORDER BY event_id, policy_version DESC
      )
      SELECT COUNT(*)::bigint as count
      FROM app_v3.event_invites ei
      JOIN latest_policy lp ON lp.event_id = ei.event_id
      WHERE (
        (lp.invite_identity_match = 'EMAIL' AND ei.target_identifier NOT LIKE '%@%')
        OR (lp.invite_identity_match = 'USERNAME' AND ei.target_identifier LIKE '%@%')
      )
    `,
  );
  const mismatchedInvitesRows = await prisma.$queryRaw<InviteRow[]>(
    Prisma.sql`
      WITH latest_policy AS (
        SELECT DISTINCT ON (event_id) event_id, invite_identity_match
        FROM app_v3.event_access_policies
        ORDER BY event_id, policy_version DESC
      )
      SELECT ei.id, ei.event_id as "eventId", e.slug, e.title,
             ei.target_identifier as "targetIdentifier",
             lp.invite_identity_match as "inviteIdentityMatch",
             ei.created_at as "createdAt"
      FROM app_v3.event_invites ei
      JOIN latest_policy lp ON lp.event_id = ei.event_id
      JOIN app_v3.events e ON e.id = ei.event_id
      WHERE (
        (lp.invite_identity_match = 'EMAIL' AND ei.target_identifier NOT LIKE '%@%')
        OR (lp.invite_identity_match = 'USERNAME' AND ei.target_identifier LIKE '%@%')
      )
      ORDER BY ei.created_at DESC
      ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}
    `,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    invalidPolicies: {
      total: invalidPolicyItems.length,
      items: invalidPolicyItems,
    },
    invalidUsernameInvites: {
      total: toNumber(invalidUsernameInvitesTotal?.[0]?.count ?? 0),
      items: invalidUsernameInvitesRows ?? [],
    },
    mismatchedInvites: {
      total: toNumber(mismatchedInvitesTotal?.[0]?.count ?? 0),
      items: mismatchedInvitesRows ?? [],
    },
  };

  let output = "";
  if (format === "json") {
    output = JSON.stringify(report, null, 2);
  } else {
    output = asMarkdown(report);
  }

  if (outPath) {
    writeFileSync(outPath, output, "utf8");
    console.log(`[audit_access_policy] Relatório escrito em ${outPath}`);
  } else {
    console.log(output);
  }
}

main()
  .catch((err) => {
    console.error("[audit_access_policy] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
