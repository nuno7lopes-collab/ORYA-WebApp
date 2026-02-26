/**
 * Audita coerencia entre evento publico e bilhetes vendaveis.
 *
 * Uso:
 *   node scripts/run-ts.cjs scripts/audit_event_ticket_integrity.ts
 */
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PUBLIC_EVENT_STATUSES } from "../domain/events/publicStatus";

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
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
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
  const events = await prisma.event.findMany({
    where: {
      status: { in: PUBLIC_EVENT_STATUSES },
      isDeleted: false,
      organization: { status: "ACTIVE" },
    },
    select: {
      slug: true,
      endsAt: true,
      ticketTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          status: true,
          startsAt: true,
          endsAt: true,
          totalQuantity: true,
          soldQuantity: true,
          sortOrder: true,
          padelEventCategoryLinkId: true,
          padelEventCategoryLink: {
            select: {
              category: { select: { label: true } },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const issues = {
    noTicketTypes: [] as string[],
    noVendableTickets: [] as string[],
    noVendableFutureTickets: [] as string[],
    priceWithoutVendableTickets: [] as string[],
    missingPriceWithVendableTickets: [] as string[],
    mismatchedPriceFrom: [] as Array<{
      slug: string;
      expected: number;
      actual: number | null;
    }>,
  };

  for (const event of events) {
    const priceFrom = event.ticketTypes
      .filter(isVendable)
      .map((ticket) =>
        typeof ticket.price === "number" ? Math.max(0, ticket.price) : null,
      )
      .filter((price): price is number => price !== null);
    const priceFromPublic = priceFrom.length > 0 ? Math.min(...priceFrom) / 100 : null;
    const vendableTickets = event.ticketTypes.filter(isVendable);
    const ticketPricesCents = vendableTickets
      .map((ticket) =>
        typeof ticket.price === "number" ? Math.max(0, ticket.price) : null,
      )
      .filter((price): price is number => price !== null);

    if (event.ticketTypes.length === 0) {
      issues.noTicketTypes.push(event.slug);
    }
    if (vendableTickets.length === 0) {
      issues.noVendableTickets.push(event.slug);
      if (!event.endsAt || event.endsAt.getTime() > Date.now()) {
        issues.noVendableFutureTickets.push(event.slug);
      }
    }

    if (ticketPricesCents.length === 0 && priceFromPublic !== null) {
      issues.priceWithoutVendableTickets.push(event.slug);
      continue;
    }

    if (ticketPricesCents.length > 0) {
      const expected = Math.min(...ticketPricesCents) / 100;
      if (priceFromPublic === null) {
        issues.missingPriceWithVendableTickets.push(event.slug);
        continue;
      }
      if (Math.abs(priceFromPublic - expected) > 0.0001) {
        issues.mismatchedPriceFrom.push({
          slug: event.slug,
          expected,
          actual: priceFromPublic,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        totalPublicEvents: events.length,
        noTicketTypesCount: issues.noTicketTypes.length,
        noVendableTicketsCount: issues.noVendableTickets.length,
        noVendableFutureTicketsCount: issues.noVendableFutureTickets.length,
        priceWithoutVendableTicketsCount:
          issues.priceWithoutVendableTickets.length,
        missingPriceWithVendableTicketsCount:
          issues.missingPriceWithVendableTickets.length,
        mismatchedPriceFromCount: issues.mismatchedPriceFrom.length,
        samples: {
          noTicketTypes: issues.noTicketTypes.slice(0, 10),
          noVendableTickets: issues.noVendableTickets.slice(0, 10),
          noVendableFutureTickets: issues.noVendableFutureTickets.slice(0, 10),
          priceWithoutVendableTickets:
            issues.priceWithoutVendableTickets.slice(0, 10),
          missingPriceWithVendableTickets:
            issues.missingPriceWithVendableTickets.slice(0, 10),
          mismatchedPriceFrom: issues.mismatchedPriceFrom.slice(0, 10),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[audit_event_ticket_integrity] Erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
