/**
 * Audita coerencia entre categorias Padel e ticket types ligados.
 *
 * Uso:
 *   node scripts/run-ts.cjs scripts/audit_padel_category_ticket_links.ts
 */
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL no ambiente.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? undefined
      : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const isVendable = (ticket: {
  status: string | null;
  totalQuantity: number | null;
  soldQuantity: number | null;
}) => {
  const status = (ticket.status ?? "").toUpperCase();
  if (status && status !== "ON_SALE") return false;
  const total = ticket.totalQuantity;
  const sold = ticket.soldQuantity ?? 0;
  return total == null ? true : sold < total;
};

async function main() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      templateType: "PADEL",
      isDeleted: false,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      padelCategoryLinks: {
        where: { isEnabled: true, isHidden: false },
        select: {
          id: true,
          padelCategoryId: true,
          category: { select: { label: true } },
        },
      },
      ticketTypes: {
        select: {
          id: true,
          name: true,
          status: true,
          totalQuantity: true,
          soldQuantity: true,
          padelEventCategoryLinkId: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const issues = {
    eventsWithoutEnabledCategories: [] as string[],
    categoriesWithoutLinkedTickets: [] as Array<{
      eventSlug: string;
      categoryLinkId: number;
      categoryLabel: string | null;
    }>,
    categoriesWithoutVendableTickets: [] as Array<{
      eventSlug: string;
      categoryLinkId: number;
      categoryLabel: string | null;
    }>,
  };

  for (const event of events) {
    if (event.padelCategoryLinks.length === 0) {
      issues.eventsWithoutEnabledCategories.push(event.slug);
      continue;
    }

    for (const link of event.padelCategoryLinks) {
      const linkedTickets = event.ticketTypes.filter(
        (ticket) => ticket.padelEventCategoryLinkId === link.id,
      );
      if (linkedTickets.length === 0) {
        issues.categoriesWithoutLinkedTickets.push({
          eventSlug: event.slug,
          categoryLinkId: link.id,
          categoryLabel: link.category?.label ?? null,
        });
        continue;
      }
      const vendableLinkedTickets = linkedTickets.filter(isVendable);
      if (vendableLinkedTickets.length === 0) {
        issues.categoriesWithoutVendableTickets.push({
          eventSlug: event.slug,
          categoryLinkId: link.id,
          categoryLabel: link.category?.label ?? null,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        totalFuturePadelEvents: events.length,
        eventsWithoutEnabledCategoriesCount:
          issues.eventsWithoutEnabledCategories.length,
        categoriesWithoutLinkedTicketsCount:
          issues.categoriesWithoutLinkedTickets.length,
        categoriesWithoutVendableTicketsCount:
          issues.categoriesWithoutVendableTickets.length,
        samples: {
          eventsWithoutEnabledCategories:
            issues.eventsWithoutEnabledCategories.slice(0, 10),
          categoriesWithoutLinkedTickets:
            issues.categoriesWithoutLinkedTickets.slice(0, 10),
          categoriesWithoutVendableTickets:
            issues.categoriesWithoutVendableTickets.slice(0, 10),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[audit_padel_category_ticket_links] Erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
