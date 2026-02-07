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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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
  console.error("[purge-padel] Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmIdx = args.indexOf("--confirm");
const confirmValue = confirmIdx >= 0 ? args[confirmIdx + 1] : null;

if (!dryRun && confirmValue !== "YES") {
  console.error("[purge-padel] Operação destrutiva. Usa --confirm YES (ou --dry-run). ");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const unique = (values) => Array.from(new Set(values.filter((v) => v !== null && v !== undefined)));
const buildOr = (conditions) => {
  const filtered = conditions.filter(Boolean);
  return filtered.length ? { OR: filtered } : null;
};

async function runDelete(label, model, where) {
  const args = where ? { where } : undefined;
  try {
    if (dryRun) {
      const count = await model.count(args);
      console.log(`[purge-padel][dry-run] ${label}:`, count);
      return;
    }
    const result = await model.deleteMany(args);
    console.log(`[purge-padel] ${label}:`, result?.count ?? "ok");
  } catch (err) {
    if (err && (err.code === "P2021" || String(err.message || "").includes("does not exist"))) {
      console.log(`[purge-padel] ${label}: skipped (missing table)`);
      return;
    }
    throw err;
  }
}

async function runDeleteIf(label, model, where) {
  if (!where) {
    console.log(`[purge-padel] ${label}: 0 (skip)`);
    return;
  }
  await runDelete(label, model, where);
}

async function runUpdate(label, model, data, where) {
  const args = { data, where };
  try {
    if (dryRun) {
      const count = await model.count({ where });
      console.log(`[purge-padel][dry-run] ${label}:`, count);
      return;
    }
    const result = await model.updateMany(args);
    console.log(`[purge-padel] ${label}:`, result?.count ?? "ok");
  } catch (err) {
    if (err && (err.code === "P2021" || String(err.message || "").includes("does not exist"))) {
      console.log(`[purge-padel] ${label}: skipped (missing table)`);
      return;
    }
    throw err;
  }
}

async function main() {
  console.log(`[purge-padel] Modo: ${dryRun ? "dry-run" : "confirm"}`);

  const [padelEventsTemplate, padelConfigs] = await Promise.all([
    prisma.event.findMany({ where: { templateType: "PADEL" }, select: { id: true } }),
    prisma.padelTournamentConfig.findMany({ select: { eventId: true } }),
  ]);
  const padelEventIds = unique([
    ...padelEventsTemplate.map((row) => row.id),
    ...padelConfigs.map((row) => row.eventId),
  ]);
  console.log("[purge-padel] Padel events:", padelEventIds.length);

  const padelPairingIds = padelEventIds.length
    ? (await prisma.padelPairing.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } }))
        .map((row) => row.id)
    : [];
  const padelRegistrationIds = padelEventIds.length
    ? (await prisma.padelRegistration.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } }))
        .map((row) => row.id)
    : [];
  const padelRegistrationLineIds = padelRegistrationIds.length
    ? (
        await prisma.padelRegistrationLine.findMany({
          where: { padelRegistrationId: { in: padelRegistrationIds } },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];

  const paymentIds = (
    await prisma.payment.findMany({
      where: { sourceType: "PADEL_REGISTRATION" },
      select: { id: true },
    })
  ).map((row) => row.id);

  const saleSummaryWhere = buildOr([
    padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
    paymentIds.length ? { purchaseId: { in: paymentIds } } : undefined,
  ]);
  const saleSummaries = saleSummaryWhere
    ? await prisma.saleSummary.findMany({
        where: saleSummaryWhere,
        select: { id: true, purchaseId: true, paymentIntentId: true },
      })
    : [];
  const saleSummaryIds = saleSummaries.map((row) => row.id);
  const salePurchaseIds = unique(saleSummaries.map((row) => row.purchaseId));
  const salePaymentIntentIds = unique(saleSummaries.map((row) => row.paymentIntentId));

  const paymentEventWhere = buildOr([
    padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
    paymentIds.length ? { purchaseId: { in: paymentIds } } : undefined,
  ]);
  const paymentEvents = paymentEventWhere
    ? await prisma.paymentEvent.findMany({
        where: paymentEventWhere,
        select: { stripePaymentIntentId: true, purchaseId: true },
      })
    : [];
  const paymentIntentIds = unique([
    ...salePaymentIntentIds,
    ...paymentEvents.map((row) => row.stripePaymentIntentId),
  ]);

  const padelClubIds = (await prisma.padelClub.findMany({ select: { id: true } })).map((row) => row.id);
  const padelPlayerProfileIds = (await prisma.padelPlayerProfile.findMany({ select: { id: true } })).map(
    (row) => row.id,
  );

  const ticketIds = padelEventIds.length
    ? (await prisma.ticket.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } })).map(
        (row) => row.id,
      )
    : [];
  const ticketOrderIds = padelEventIds.length
    ? (
        await prisma.ticketOrder.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } })
      ).map((row) => row.id)
    : [];
  const promoCodeIds = padelEventIds.length
    ? (
        await prisma.promoCode.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } })
      ).map((row) => row.id)
    : [];

  const tournamentIds = padelEventIds.length
    ? (
        await prisma.tournament.findMany({ where: { eventId: { in: padelEventIds } }, select: { id: true } })
      ).map((row) => row.id)
    : [];
  const stageIds = tournamentIds.length
    ? (
        await prisma.tournamentStage.findMany({
          where: { tournamentId: { in: tournamentIds } },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];
  const matchIds = stageIds.length
    ? (
        await prisma.tournamentMatch.findMany({ where: { stageId: { in: stageIds } }, select: { id: true } })
      ).map((row) => row.id)
    : [];

  console.log("[purge-padel] Payments:", paymentIds.length);
  console.log("[purge-padel] Registrations:", padelRegistrationIds.length);

  await runUpdate(
    "Organization.padelDefaultRuleSetId -> null",
    prisma.organization,
    { padelDefaultRuleSetId: null },
    { padelDefaultRuleSetId: { not: null } },
  );

  await runDeleteIf(
    "Notification (eventId)",
    prisma.notification,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "EntitlementCheckin (padel events)",
    prisma.entitlementCheckin,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  const padelEntitlementWhere = {
    OR: [
      { type: "PADEL_ENTRY" },
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
    ].filter(Boolean),
  };
  const padelEntitlementIds = (
    await prisma.entitlement.findMany({ where: padelEntitlementWhere, select: { id: true } })
  ).map((row) => row.id);

  await runDeleteIf(
    "EntitlementQrToken",
    prisma.entitlementQrToken,
    padelEntitlementIds.length ? { entitlementId: { in: padelEntitlementIds } } : null,
  );
  await runDelete("Entitlement", prisma.entitlement, padelEntitlementWhere);

  await runDeleteIf(
    "SaleLine (padel)",
    prisma.saleLine,
    buildOr([
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
      padelRegistrationLineIds.length ? { padelRegistrationLineId: { in: padelRegistrationLineIds } } : undefined,
    ]),
  );
  await runDeleteIf(
    "SaleSummary (padel)",
    prisma.saleSummary,
    saleSummaryWhere,
  );

  await runDeleteIf(
    "Refund (padel)",
    prisma.refund,
    buildOr([
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
      paymentIds.length ? { purchaseId: { in: paymentIds } } : undefined,
      paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : undefined,
    ]),
  );

  await runDeleteIf(
    "PaymentEvent (padel)",
    prisma.paymentEvent,
    paymentEventWhere,
  );

  await runDeleteIf(
    "PaymentSnapshot (padel)",
    prisma.paymentSnapshot,
    paymentIds.length ? { paymentId: { in: paymentIds } } : null,
  );
  await runDeleteIf(
    "LedgerEntry (padel)",
    prisma.ledgerEntry,
    paymentIds.length ? { paymentId: { in: paymentIds } } : null,
  );
  await runDeleteIf(
    "Payment (padel)",
    prisma.payment,
    paymentIds.length ? { id: { in: paymentIds } } : null,
  );

  await runDeleteIf(
    "Operation (padel)",
    prisma.operation,
    buildOr([
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
      paymentIds.length ? { purchaseId: { in: paymentIds } } : undefined,
      paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : undefined,
      padelPairingIds.length ? { pairingId: { in: padelPairingIds } } : undefined,
    ]),
  );

  await runDeleteIf(
    "OutboxEvent (padel)",
    prisma.outboxEvent,
    buildOr([
      paymentIds.length ? { correlationId: { in: paymentIds } } : undefined,
      paymentIds.length ? { causationId: { in: paymentIds } } : undefined,
      padelRegistrationIds.length ? { correlationId: { in: padelRegistrationIds } } : undefined,
    ]),
  );

  await runDelete(
    "EventLog (padel)",
    prisma.eventLog,
    {
      OR: [
        { sourceType: "PADEL_REGISTRATION" },
        padelRegistrationIds.length ? { sourceId: { in: padelRegistrationIds } } : undefined,
        padelEventIds.length ? { sourceType: "EVENT", sourceId: { in: padelEventIds.map(String) } } : undefined,
      ].filter(Boolean),
    },
  );

  await runDeleteIf(
    "PadelPairingSlot",
    prisma.padelPairingSlot,
    padelPairingIds.length ? { pairingId: { in: padelPairingIds } } : null,
  );
  await runDeleteIf(
    "PadelRegistrationLine",
    prisma.padelRegistrationLine,
    padelRegistrationIds.length ? { padelRegistrationId: { in: padelRegistrationIds } } : null,
  );
  await runDeleteIf(
    "PadelRegistration",
    prisma.padelRegistration,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "PadelPairingHold",
    prisma.padelPairingHold,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "PadelWaitlistEntry",
    prisma.padelWaitlistEntry,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "TournamentEntry",
    prisma.tournamentEntry,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "MatchNotification",
    prisma.matchNotification,
    matchIds.length ? { matchId: { in: matchIds } } : null,
  );
  await runDeleteIf(
    "TournamentMatch",
    prisma.tournamentMatch,
    stageIds.length ? { stageId: { in: stageIds } } : null,
  );
  await runDeleteIf(
    "TournamentGroup",
    prisma.tournamentGroup,
    stageIds.length ? { stageId: { in: stageIds } } : null,
  );
  await runDeleteIf(
    "TournamentStage",
    prisma.tournamentStage,
    tournamentIds.length ? { tournamentId: { in: tournamentIds } } : null,
  );
  await runDeleteIf(
    "TournamentAuditLog",
    prisma.tournamentAuditLog,
    tournamentIds.length ? { tournamentId: { in: tournamentIds } } : null,
  );
  await runDeleteIf(
    "Tournament",
    prisma.tournament,
    tournamentIds.length ? { id: { in: tournamentIds } } : null,
  );

  await runDeleteIf(
    "EventMatchSlot",
    prisma.eventMatchSlot,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "CalendarAvailability (padel)",
    prisma.calendarAvailability,
    buildOr([
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
      padelPlayerProfileIds.length ? { playerProfileId: { in: padelPlayerProfileIds } } : undefined,
    ]),
  );
  await runDeleteIf(
    "CalendarBlock (padel)",
    prisma.calendarBlock,
    buildOr([
      padelEventIds.length ? { eventId: { in: padelEventIds } } : undefined,
      padelClubIds.length ? { padelClubId: { in: padelClubIds } } : undefined,
    ]),
  );

  await runDeleteIf(
    "PadelPairing",
    prisma.padelPairing,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "PadelRankingEntry",
    prisma.padelRankingEntry,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "PadelTournamentRoleAssignment",
    prisma.padelTournamentRoleAssignment,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "PadelTournamentConfig",
    prisma.padelTournamentConfig,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "PadelEventCategoryLink",
    prisma.padelEventCategoryLink,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "EventInvite",
    prisma.eventInvite,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "EventFavorite",
    prisma.eventFavorite,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "EventAccessPolicy",
    prisma.eventAccessPolicy,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "InviteToken",
    prisma.inviteToken,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "TicketReservation",
    prisma.ticketReservation,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "TicketOrderLine",
    prisma.ticketOrderLine,
    ticketOrderIds.length ? { ticketOrderId: { in: ticketOrderIds } } : null,
  );
  await runDeleteIf(
    "TicketOrder",
    prisma.ticketOrder,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "TicketResale",
    prisma.ticketResale,
    ticketIds.length ? { ticketId: { in: ticketIds } } : null,
  );
  await runDeleteIf(
    "GuestTicketLink",
    prisma.guestTicketLink,
    ticketIds.length ? { ticketId: { in: ticketIds } } : null,
  );
  await runDeleteIf(
    "Ticket",
    prisma.ticket,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "TicketType",
    prisma.ticketType,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "PromoRedemption",
    prisma.promoRedemption,
    buildOr([
      promoCodeIds.length ? { promoCodeId: { in: promoCodeIds } } : undefined,
      paymentIds.length ? { purchaseId: { in: paymentIds } } : undefined,
    ]),
  );
  await runDeleteIf(
    "PromoCode",
    prisma.promoCode,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDeleteIf(
    "RefundPolicyVersion",
    prisma.refundPolicyVersion,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );

  await runDeleteIf(
    "PadelTeamEntry",
    prisma.padelTeamEntry,
    padelEventIds.length ? { eventId: { in: padelEventIds } } : null,
  );
  await runDelete("PadelTeamMember", prisma.padelTeamMember, undefined);
  await runDelete("PadelTeam", prisma.padelTeam, undefined);

  await runDelete("PadelCommunityReaction", prisma.padelCommunityReaction, undefined);
  await runDelete("PadelCommunityComment", prisma.padelCommunityComment, undefined);
  await runDelete("PadelCommunityPost", prisma.padelCommunityPost, undefined);

  await runDelete("PadelClubStaff", prisma.padelClubStaff, undefined);
  await runDelete("PadelClubCourt", prisma.padelClubCourt, undefined);
  await runDelete("PadelClub", prisma.padelClub, undefined);

  await runDelete("PadelPlayerProfile", prisma.padelPlayerProfile, undefined);
  await runDelete("PadelCategory", prisma.padelCategory, undefined);
  await runDelete("PadelRuleSetVersion", prisma.padelRuleSetVersion, undefined);
  await runDelete("PadelRuleSet", prisma.padelRuleSet, undefined);

  await runDeleteIf(
    "Event (padel)",
    prisma.event,
    padelEventIds.length ? { id: { in: padelEventIds } } : null,
  );

  console.log("[purge-padel] Concluido.");
}

main()
  .catch((err) => {
    console.error("[purge-padel] Erro:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
