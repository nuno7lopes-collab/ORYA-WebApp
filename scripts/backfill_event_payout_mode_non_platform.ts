import fs from "node:fs";
import path from "node:path";
import { OrgType, PayoutMode, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type Args = {
  apply: boolean;
  orgIds: number[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply") && !args.includes("--dry-run");
  const orgArg = args.find((arg) => arg.startsWith("--org=")) ?? null;
  const orgIds =
    orgArg
      ?.slice("--org=".length)
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.floor(value)) ?? [];

  return {
    apply,
    orgIds: Array.from(new Set(orgIds)),
  };
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma connection.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function main() {
  const { apply, orgIds } = parseArgs();
  const mode = apply ? "apply" : "dry-run";
  const timestamp = new Date().toISOString();

  const rows = await prisma.event.findMany({
    where: {
      payoutMode: PayoutMode.PLATFORM,
      organization: {
        orgType: OrgType.EXTERNAL,
      },
      ...(orgIds.length > 0 ? { organizationId: { in: orgIds } } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      payoutMode: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          username: true,
          publicName: true,
          orgType: true,
        },
      },
    },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }],
  });

  const byOrganization = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const key = String(row.organizationId ?? "null");
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});

  let updatedCount = 0;
  if (apply && rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const updated = await prisma.event.updateMany({
      where: {
        id: { in: ids },
        payoutMode: PayoutMode.PLATFORM,
      },
      data: {
        payoutMode: PayoutMode.ORGANIZATION,
      },
    });
    updatedCount = updated.count;
  }

  const organizations = Object.values(byOrganization).map((group) => {
    const first = group[0];
    return {
      organizationId: first.organizationId,
      username: first.organization?.username ?? null,
      publicName: first.organization?.publicName ?? null,
      orgType: first.organization?.orgType ?? null,
      events: group.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        fromPayoutMode: event.payoutMode,
        toPayoutMode: PayoutMode.ORGANIZATION,
      })),
    };
  });

  const report = {
    script: "backfill_event_payout_mode_non_platform",
    timestamp,
    mode,
    scopedOrganizationIds: orgIds,
    inconsistentEventsCount: rows.length,
    inconsistentOrganizationsCount: organizations.length,
    updatedCount,
    organizations,
  };

  const reportPath = path.join(
    "/tmp",
    `backfill_event_payout_mode_non_platform_${timestamp.replaceAll(":", "-")}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    `[backfill_event_payout_mode_non_platform] mode=${mode} orgs=${organizations.length} events=${rows.length} updated=${updatedCount}`,
  );
  organizations.forEach((org) => {
    console.log(
      `[backfill_event_payout_mode_non_platform] org=${org.organizationId ?? "null"} user=${org.username ?? "-"} events=${org.events.length}`,
    );
  });
  console.log(`[backfill_event_payout_mode_non_platform] report=${reportPath}`);
}

main()
  .catch((error) => {
    console.error("[backfill_event_payout_mode_non_platform] error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
