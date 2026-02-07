// scripts/check-slug.js
// Helper para verificar se um slug existe na tabela app_v3.events

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const slug = process.argv[2];

if (!slug) {
  console.error("Uso: node scripts/check-slug.js <slug>");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      startsAt: true,
      endsAt: true,
      addressId: true,
      addressRef: { select: { formattedAddress: true } },
      organizationId: true,
    },
  });

  console.log(event);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
 
