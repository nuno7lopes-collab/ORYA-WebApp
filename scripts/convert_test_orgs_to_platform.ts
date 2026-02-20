import fs from "node:fs";
import path from "node:path";
import { OrgType, PayoutMode, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type Args = {
  apply: boolean;
  usernames: string[];
};

type OrgBeforeAfter = {
  id: number;
  username: string | null;
  publicName: string | null;
  before: {
    orgType: string | null;
    officialEmail: string | null;
    officialEmailVerifiedAt: string | null;
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean | null;
    stripePayoutsEnabled: boolean | null;
  };
  after: {
    orgType: string;
    officialEmail: string;
    officialEmailVerifiedAt: string;
    stripeAccountId: null;
    stripeChargesEnabled: false;
    stripePayoutsEnabled: false;
  };
  events: Array<{
    id: number;
    slug: string;
    title: string;
    beforePayoutMode: string | null;
    afterPayoutMode: "PLATFORM";
  }>;
};

type ConversionReport = {
  script: string;
  timestamp: string;
  mode: "dry-run" | "apply";
  usernames: string[];
  organizationsFound: number;
  organizationsConverted: number;
  eventsConverted: number;
  organizations: OrgBeforeAfter[];
};

function loadEnvFile(file: string) {
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
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const usernamesArg = args.find((arg) => arg.startsWith("--org-usernames=")) ?? "";
  const usernamesRaw = usernamesArg.replace("--org-usernames=", "");
  const usernames = Array.from(
    new Set(
      usernamesRaw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return { apply, usernames };
}

function assertArgs(args: Args) {
  if (args.usernames.length === 0) {
    throw new Error(
      "Falta --org-usernames. Exemplo: --org-usernames=top_padel,nike_padel_lab",
    );
  }
}

function resolveOfficialEmail(input: { username: string | null; officialEmail: string | null }) {
  const current = input.officialEmail?.trim().toLowerCase() ?? "";
  if (current) return current;
  const username = input.username?.trim().toLowerCase() ?? "org";
  return `${username}@orya.test`;
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error("Falta DATABASE_URL ou DIRECT_URL no ambiente.");
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function buildReport(usernames: string[]): Promise<ConversionReport> {
  const organizations = await prisma.organization.findMany({
    where: {
      username: { in: usernames },
    },
    select: {
      id: true,
      username: true,
      publicName: true,
      orgType: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      events: {
        select: {
          id: true,
          slug: true,
          title: true,
          payoutMode: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const mapped: OrgBeforeAfter[] = organizations.map((org) => {
    const officialEmail = resolveOfficialEmail({
      username: org.username,
      officialEmail: org.officialEmail,
    });
    const verifiedAt = (org.officialEmailVerifiedAt ?? new Date()).toISOString();
    return {
      id: org.id,
      username: org.username,
      publicName: org.publicName,
      before: {
        orgType: org.orgType ?? null,
        officialEmail: org.officialEmail ?? null,
        officialEmailVerifiedAt: org.officialEmailVerifiedAt
          ? org.officialEmailVerifiedAt.toISOString()
          : null,
        stripeAccountId: org.stripeAccountId ?? null,
        stripeChargesEnabled: org.stripeChargesEnabled ?? null,
        stripePayoutsEnabled: org.stripePayoutsEnabled ?? null,
      },
      after: {
        orgType: OrgType.PLATFORM,
        officialEmail,
        officialEmailVerifiedAt: verifiedAt,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      },
      events: org.events.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        beforePayoutMode: event.payoutMode ?? null,
        afterPayoutMode: PayoutMode.PLATFORM,
      })),
    };
  });

  return {
    script: "convert_test_orgs_to_platform",
    timestamp: new Date().toISOString(),
    mode: "dry-run",
    usernames,
    organizationsFound: mapped.length,
    organizationsConverted: mapped.filter((org) => org.before.orgType !== "PLATFORM").length,
    eventsConverted: mapped.reduce(
      (acc, org) => acc + org.events.filter((event) => event.beforePayoutMode !== "PLATFORM").length,
      0,
    ),
    organizations: mapped,
  };
}

async function applyReport(report: ConversionReport): Promise<ConversionReport> {
  const targetOrgIds = report.organizations.map((org) => org.id);
  if (targetOrgIds.length === 0) {
    return { ...report, mode: "apply", organizationsConverted: 0, eventsConverted: 0 };
  }

  let organizationsConverted = 0;
  let eventsConverted = 0;

  await prisma.$transaction(async (tx) => {
    for (const organization of report.organizations) {
      const officialEmail = organization.after.officialEmail;
      const verifiedAt = new Date(organization.after.officialEmailVerifiedAt);
      await tx.organization.update({
        where: { id: organization.id },
        data: {
          orgType: OrgType.PLATFORM,
          officialEmail,
          officialEmailVerifiedAt: verifiedAt,
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      });
      if (organization.before.orgType !== "PLATFORM") {
        organizationsConverted += 1;
      }
    }

    const eventUpdate = await tx.event.updateMany({
      where: {
        organizationId: { in: targetOrgIds },
        payoutMode: { not: PayoutMode.PLATFORM },
      },
      data: {
        payoutMode: PayoutMode.PLATFORM,
      },
    });
    eventsConverted = eventUpdate.count;
  });

  return {
    ...report,
    mode: "apply",
    organizationsConverted,
    eventsConverted,
  };
}

function writeReport(report: ConversionReport) {
  const timestamp = report.timestamp.replaceAll(":", "-");
  const filePath = path.join("/tmp", `convert_test_orgs_to_platform_${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
  return filePath;
}

async function main() {
  const args = parseArgs();
  assertArgs(args);
  const dryRunReport = await buildReport(args.usernames);
  const finalReport = args.apply ? await applyReport(dryRunReport) : dryRunReport;
  const reportPath = writeReport(finalReport);

  console.log(
    `[convert_test_orgs_to_platform] mode=${finalReport.mode} usernames=${args.usernames.join(",")} orgsFound=${finalReport.organizationsFound} orgsConverted=${finalReport.organizationsConverted} eventsConverted=${finalReport.eventsConverted}`,
  );
  console.log(`[convert_test_orgs_to_platform] report=${reportPath}`);
}

main()
  .catch((err) => {
    console.error("[convert_test_orgs_to_platform] error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
