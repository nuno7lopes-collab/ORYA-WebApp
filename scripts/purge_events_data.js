const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile(file) {
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

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function runDelete(label, action) {
  const result = await action();
  const count = typeof result?.count === "number" ? result.count : undefined;
  console.log(`[purge-events] ${label}:`, count ?? "ok");
}

async function main() {
  console.log("[purge-events] A iniciar limpeza de eventos/pagamentos/bilhetes...");

  await runDelete("Notification (eventId/ticketId)", () =>
    prisma.notification.deleteMany({
      where: {
        OR: [{ eventId: { not: null } }, { ticketId: { not: null } }],
      },
    })
  );

  await runDelete("EntitlementCheckin", () => prisma.entitlementCheckin.deleteMany());
  await runDelete("EntitlementQrToken", () => prisma.entitlementQrToken.deleteMany());
  await runDelete("Entitlement", () => prisma.entitlement.deleteMany());

  await runDelete("PadelPairingSlot", () => prisma.padelPairingSlot.deleteMany());

  await runDelete("EventMatchSlot", () => prisma.eventMatchSlot.deleteMany());
  await runDelete("PadelPairingHold", () => prisma.padelPairingHold.deleteMany());
  await runDelete("PadelWaitlistEntry", () => prisma.padelWaitlistEntry.deleteMany());
  await runDelete("TournamentEntry", () => prisma.tournamentEntry.deleteMany());

  await runDelete("TicketResale", () => prisma.ticketResale.deleteMany());
  await runDelete("GuestTicketLink", () => prisma.guestTicketLink.deleteMany());
  await runDelete("TicketReservation", () => prisma.ticketReservation.deleteMany());
  await runDelete("Ticket", () => prisma.ticket.deleteMany());
  await runDelete("TicketType", () => prisma.ticketType.deleteMany());

  await runDelete("SaleLine", () => prisma.saleLine.deleteMany());
  await runDelete("SaleSummary", () => prisma.saleSummary.deleteMany());
  await runDelete("PromoRedemption", () => prisma.promoRedemption.deleteMany());
  await runDelete("PromoCode", () => prisma.promoCode.deleteMany());
  await runDelete("Refund", () => prisma.refund.deleteMany());
  await runDelete("PaymentEvent", () => prisma.paymentEvent.deleteMany());
  await runDelete("Operation (payments)", () =>
    prisma.operation.deleteMany({
      where: {
        OR: [
          { eventId: { not: null } },
          { paymentIntentId: { not: null } },
          { purchaseId: { not: null } },
          { stripeEventId: { not: null } },
        ],
      },
    })
  );

  await runDelete("CalendarAvailability", () => prisma.calendarAvailability.deleteMany());
  await runDelete("CalendarBlock", () => prisma.calendarBlock.deleteMany());
  await runDelete("PadelRankingEntry", () => prisma.padelRankingEntry.deleteMany());
  await runDelete("PadelTournamentConfig", () => prisma.padelTournamentConfig.deleteMany());
  await runDelete("PadelEventCategoryLink", () => prisma.padelEventCategoryLink.deleteMany());

  await runDelete("TournamentMatch", () => prisma.tournamentMatch.deleteMany());
  await runDelete("TournamentGroup", () => prisma.tournamentGroup.deleteMany());
  await runDelete("TournamentStage", () => prisma.tournamentStage.deleteMany());
  await runDelete("TournamentAuditLog", () => prisma.tournamentAuditLog.deleteMany());
  await runDelete("Tournament", () => prisma.tournament.deleteMany());

  await runDelete("PadelPairing", () => prisma.padelPairing.deleteMany());
  await runDelete("EventInvite", () => prisma.eventInvite.deleteMany());
  await runDelete("Event", () => prisma.event.deleteMany());

  console.log("[purge-events] Limpeza concluida.");
}

main()
  .catch((err) => {
    console.error("[purge-events] Erro:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
