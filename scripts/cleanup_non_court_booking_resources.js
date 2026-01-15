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

async function main() {
  const where = {
    service: { is: { kind: { not: "COURT" } } },
    OR: [
      { resourceId: { not: null } },
      { partySize: { not: null } },
      { assignmentMode: "RESOURCE" },
    ],
  };

  const count = await prisma.booking.count({ where });
  console.log(`[cleanup] found ${count} non-court bookings with resource metadata`);

  if (!apply) {
    const sample = await prisma.booking.findMany({
      where,
      take: 10,
      orderBy: { id: "asc" },
      select: {
        id: true,
        assignmentMode: true,
        resourceId: true,
        partySize: true,
        service: { select: { id: true, title: true, kind: true } },
      },
    });
    console.log("[cleanup] dry run. Pass --apply to update.");
    console.log(sample);
    return;
  }

  if (!count) {
    console.log("[cleanup] nothing to update.");
    return;
  }

  const result = await prisma.booking.updateMany({
    where,
    data: {
      resourceId: null,
      partySize: null,
      assignmentMode: "PROFESSIONAL",
    },
  });

  console.log(`[cleanup] updated ${result.count} bookings.`);
}

main()
  .catch((err) => {
    console.error("[cleanup] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
