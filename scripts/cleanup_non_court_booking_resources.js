const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { config } = require("dotenv");

config({ path: ".env.local" });
config();

const args = process.argv.slice(2);
const apply = args.includes("--apply");

const databaseUrl = process.env.DATABASE_URL;
const adapter =
  databaseUrl && databaseUrl.startsWith("postgres")
    ? new PrismaPg({ connectionString: databaseUrl })
    : null;

const prisma = new PrismaClient(adapter ? { adapter } : {});

const ISSUE_QUERIES = {
  PROFESSIONAL_ONLY_WITH_RESOURCE: {
    assignmentMode: "PROFESSIONAL_ONLY",
    OR: [{ resourceId: { not: null } }, { courtId: { not: null } }],
  },
  RESOURCE_ONLY_WITH_PROFESSIONAL: {
    assignmentMode: "RESOURCE_ONLY",
    professionalId: { not: null },
  },
  HYBRID_MISSING_PROFESSIONAL: {
    assignmentMode: "PROFESSIONAL_AND_RESOURCE",
    professionalId: null,
  },
  HYBRID_MISSING_RESOURCE: {
    assignmentMode: "PROFESSIONAL_AND_RESOURCE",
    resourceId: null,
  },
};

async function countIssues() {
  const rows = await Promise.all(
    Object.entries(ISSUE_QUERIES).map(async ([issue, where]) => ({
      issue,
      count: await prisma.booking.count({ where }),
    })),
  );
  return rows.filter((row) => row.count > 0);
}

async function sampleIssues() {
  const out = [];
  for (const [issue, where] of Object.entries(ISSUE_QUERIES)) {
    const rows = await prisma.booking.findMany({
      where,
      take: 5,
      orderBy: { id: "asc" },
      select: {
        id: true,
        assignmentMode: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
        partySize: true,
        service: {
          select: { id: true, title: true, kind: true },
        },
      },
    });
    rows.forEach((row) => out.push({ issue, ...row }));
  }
  return out;
}

async function applySafeFixes() {
  // Keep PROFESSIONAL_ONLY consistent.
  const professionalOnlyFix = await prisma.booking.updateMany({
    where: ISSUE_QUERIES.PROFESSIONAL_ONLY_WITH_RESOURCE,
    data: { resourceId: null, courtId: null },
  });

  // Keep RESOURCE_ONLY consistent.
  const resourceOnlyFix = await prisma.booking.updateMany({
    where: ISSUE_QUERIES.RESOURCE_ONLY_WITH_PROFESSIONAL,
    data: { professionalId: null },
  });

  return {
    professionalOnlyFix: professionalOnlyFix.count,
    resourceOnlyFix: resourceOnlyFix.count,
  };
}

async function main() {
  const issues = await countIssues();
  const total = issues.reduce((acc, row) => acc + row.count, 0);
  console.log(`[cleanup] integrity issues found: ${total}`);
  issues.forEach((row) => {
    console.log(` - ${row.issue}: ${row.count}`);
  });

  if (!total) {
    console.log("[cleanup] nothing to do.");
    return;
  }

  const sample = await sampleIssues();
  console.log("[cleanup] sample:");
  console.table(sample);

  if (!apply) {
    console.log("[cleanup] dry run. Pass --apply to run safe fixes.");
    console.log(
      "[cleanup] note: HYBRID issues (missing professional/resource) are intentionally audit-only.",
    );
    return;
  }

  const fixed = await applySafeFixes();
  console.log(`[cleanup] fixed PROFESSIONAL_ONLY rows: ${fixed.professionalOnlyFix}`);
  console.log(`[cleanup] fixed RESOURCE_ONLY rows: ${fixed.resourceOnlyFix}`);

  const remaining = await countIssues();
  const remainingTotal = remaining.reduce((acc, row) => acc + row.count, 0);
  console.log(`[cleanup] remaining issues: ${remainingTotal}`);
  remaining.forEach((row) => {
    console.log(` - ${row.issue}: ${row.count}`);
  });
}

main()
  .catch((err) => {
    console.error("[cleanup] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
