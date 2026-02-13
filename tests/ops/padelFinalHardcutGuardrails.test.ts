import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel final hard-cut guardrails", () => {
  it("remove bypass de criação de parceiro no wizard e exige acordo aprovado", () => {
    const wizard = readLocal("app/organizacao/(dashboard)/eventos/novo/page.tsx");
    const clubsRoute = readLocal("app/api/padel/clubs/route.ts");

    expect(wizard).not.toContain("createPartnerClubFromDirectory");
    expect(wizard).toContain("Selecionar parceiro");
    expect(clubsRoute).toContain("AGREEMENT_REQUIRED");
    expect(clubsRoute).toContain("const isPartner");
    expect(clubsRoute).toContain("isPartner && !existing");
  });

  it("expõe gestão operacional de parcerias no hub de clube", () => {
    const hub = readLocal("app/organizacao/(dashboard)/padel/PadelHubClient.tsx");
    expect(hub).toContain("\"partnerships\"");
    expect(hub).toContain("Parcerias operacionais");
    expect(hub).toContain("/api/padel/partnerships/agreements");
    expect(hub).toContain("runPartnershipAction");
  });

  it("força contrato canónico de standings em público/widget/mobile", () => {
    const standings = readLocal("app/api/padel/standings/route.ts");
    const liveLegacy = readLocal("app/api/padel/live/route.ts");
    const liveStream = readLocal("app/api/live/events/[slug]/stream/route.ts");
    const widgetStandings = readLocal("app/api/widgets/padel/standings/route.ts");
    const mobileApi = readLocal("apps/mobile/features/tournaments/api.ts");
    const publicClient = readLocal("app/eventos/[slug]/PadelPublicTablesClient.tsx");

    expect(standings).toContain("entityType");
    expect(standings).toContain("rows");
    expect(standings).toContain("groups");
    expect(liveLegacy).toContain("LIVE_ENDPOINT_MOVED");
    expect(liveLegacy).toContain("/api/live/events/:slug/stream");
    expect(liveStream).toContain("buildPadelLivePayload");
    expect(liveStream).toContain("text/event-stream");
    expect(widgetStandings).toContain("entityType");
    expect(widgetStandings).toContain("rows");
    expect(widgetStandings).toContain("groups");
    expect(mobileApi).toContain("PadelStandingEntityType");
    expect(mobileApi).toContain("rows: Array.isArray(unwrapped.rows) ? unwrapped.rows : []");
    expect(publicClient).toContain("initialEntityType");
    expect(publicClient).toContain("/api/live/events/");
    expect(publicClient).toContain("/stream");
  });

  it("usa winnerSide + winnerParticipantId no write-path de resultados", () => {
    const matchesRoute = readLocal("app/api/padel/matches/route.ts");
    const walkoverRoute = readLocal("app/api/padel/matches/[id]/walkover/route.ts");
    const undoRoute = readLocal("app/api/padel/matches/[id]/undo/route.ts");
    const assignRoute = readLocal("app/api/padel/matches/assign/route.ts");

    expect(matchesRoute).toContain("winnerSide");
    expect(matchesRoute).toContain("winnerParticipantId");
    expect(matchesRoute).not.toContain("winnerPairingId");
    expect(walkoverRoute).toContain("winnerSide");
    expect(walkoverRoute).toContain("winnerParticipantId");
    expect(walkoverRoute).not.toContain("winnerPairingFallback");
    expect(undoRoute).toContain("winnerSide");
    expect(undoRoute).toContain("winnerParticipantId");
    expect(undoRoute).not.toContain("winnerPairingId");
    expect(undoRoute).not.toContain("pairingAId");
    expect(undoRoute).not.toContain("pairingBId");
    expect(assignRoute).toContain("padelMatchParticipant");
    expect(assignRoute).toContain("winnerParticipantId");
  });

  it("remove dependência pairing-centric no scheduling canónico de calendário", () => {
    const calendarRoute = readLocal("app/api/padel/calendar/route.ts");
    const autoScheduleRoute = readLocal("app/api/padel/calendar/auto-schedule/route.ts");
    const autoScheduleDomain = readLocal("domain/padel/autoSchedule.ts");
    const outbox = readLocal("domain/padel/outbox.ts");
    expect(calendarRoute).toContain("resolveMatchPlayerProfileIds");
    expect(calendarRoute).toContain("resolveMatchUserIds");
    expect(calendarRoute).not.toContain("pairingAId");
    expect(calendarRoute).not.toContain("pairingBId");
    expect(calendarRoute).not.toContain("winnerPairingId");
    expect(autoScheduleRoute).toContain("sideAProfileIds");
    expect(autoScheduleRoute).toContain("sideBProfileIds");
    expect(autoScheduleRoute).not.toContain("padelPairing");
    expect(autoScheduleRoute).not.toContain("resolveSourcePairingIdForSide");
    expect(autoScheduleDomain).toContain("MISSING_PARTICIPANTS");
    expect(autoScheduleDomain).not.toContain("pairingPlayers");
    expect(autoScheduleDomain).not.toContain("MISSING_PAIRINGS");
    expect(outbox).not.toContain("pairingPlayers");
    expect(outbox).toContain("resolveSideProfileIds");
  });

  it("mantém consistência de desempate determinístico no live canónico padel", () => {
    const liveCanonical = readLocal("app/api/live/events/[slug]/route.ts");
    const livehubDeprecated = readLocal("app/api/livehub/[slug]/route.ts");
    const liveClient = readLocal("app/eventos/[slug]/EventLiveClient.tsx");
    expect(liveCanonical).toContain("tieBreakRulesForPadelFormat");
    expect(liveCanonical).toContain("drawOrderSeed");
    expect(liveCanonical).toContain("computePadelStandingsByGroupForPlayers");
    expect(liveCanonical).toContain("liveAllowed");
    expect(liveCanonical).toContain("live:");
    expect(liveCanonical).not.toContain("liveHub:");
    expect(liveCanonical).not.toContain("liveHubConfig");
    expect(liveClient).not.toContain("liveHubConfig");
    expect(livehubDeprecated).toContain("LIVEHUB_ROUTE_DEPRECATED");
    expect(livehubDeprecated).toContain("/api/live/events/");
  });

  it("usa naming liveVisibility no frontend organizacional sem aliases liveHub", () => {
    const createPage = readLocal("app/organizacao/(dashboard)/eventos/novo/page.tsx");
    const editPage = readLocal("app/organizacao/(dashboard)/eventos/EventEditClient.tsx");
    const livePrep = readLocal("app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx");
    const liveDashboard = readLocal("app/organizacao/(dashboard)/eventos/EventLiveDashboardClient.tsx");
    for (const content of [createPage, editPage, livePrep, liveDashboard]) {
      expect(content).toContain("liveVisibility");
      expect(content).not.toContain("LiveHubVisibility");
      expect(content).not.toContain("setLiveHubVisibility");
    }
  });

  it("fecha enum de visibilidade live no schema sem alias legacy", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("enum LiveVisibility {");
    expect(schema).not.toContain("enum LiveHubVisibility {");
  });

  it("força rotação individual em AMERICANO/MEXICANO no gerador canónico", () => {
    const generator = readLocal("domain/padel/autoGenerateMatches.ts");
    expect(generator).toContain("NEED_PLAYERS_FOR_INDIVIDUAL_FORMAT");
    expect(generator).toContain("AUTO_ROTATION:");
    expect(generator).toContain("individual-rotation");
    expect(generator).toContain("resultType: \"BYE_NEUTRAL\"");
    expect(generator).toContain("participantAssignments");
    expect(generator).not.toContain("ensureSyntheticPairing");
  });

  it("recompõe MEXICANO por performance na transição de ronda live", () => {
    const nextRound = readLocal("app/api/padel/live/timer/next-round/route.ts");
    const mexicanoDomain = readLocal("domain/padel/mexicanoRecomposition.ts");
    expect(nextRound).toContain("recomposeMexicanoForNextRound");
    expect(nextRound).toContain("computePadelStandingsByGroupForPlayers");
    expect(nextRound).toContain("deriveMexicanoRoundEntries");
    expect(nextRound).toContain("mexicanoRecomposition");
    expect(nextRound).toContain("padelMatchParticipant");
    expect(nextRound).not.toContain("ensureSyntheticPairing");
    expect(nextRound).not.toContain("partnerLinkToken");
    expect(mexicanoDomain).toContain("buildMexicanoRoundRelations");
    expect(mexicanoDomain).toContain("deriveMexicanoRoundEntries");
  });

  it("enforce sanção de ranking em ações de jogador no pairing flow", () => {
    const createPairing = readLocal("app/api/padel/pairings/route.ts");
    const openPairing = readLocal("app/api/padel/pairings/open/route.ts");
    const acceptPairing = readLocal("app/api/padel/pairings/[id]/accept/route.ts");
    const claimPairing = readLocal("app/api/padel/pairings/claim/[token]/route.ts");
    const invitePairing = readLocal("app/api/padel/pairings/[id]/invite/route.ts");
    const assumePairing = readLocal("app/api/padel/pairings/[id]/assume/route.ts");

    expect(createPairing).toContain("ensurePadelRatingActionAllowed");
    expect(openPairing).toContain("ensurePadelRatingActionAllowed");
    expect(acceptPairing).toContain("ensurePadelRatingActionAllowed");
    expect(claimPairing).toContain("ensurePadelRatingActionAllowed");
    expect(invitePairing).toContain("ensurePadelRatingActionAllowed");
    expect(assumePairing).toContain("ensurePadelRatingActionAllowed");
    expect(claimPairing).toContain("error: ratingGate.error");
  });

  it("remove consumo de SSE legado em /api/padel/live nos clientes ativos", () => {
    const publicTables = readLocal("app/eventos/[slug]/PadelPublicTablesClient.tsx");
    const monitor = readLocal("app/eventos/[slug]/monitor/PadelMonitorClient.tsx");
    const score = readLocal("app/eventos/[slug]/score/PadelScoreboardClient.tsx");
    const widgetCalendar = readLocal("app/widgets/padel/calendar/CalendarWidgetClient.tsx");
    const widgetBracket = readLocal("app/widgets/padel/bracket/BracketWidgetClient.tsx");
    const widgetNext = readLocal("app/widgets/padel/next/NextMatchesWidgetClient.tsx");
    const widgetStandings = readLocal("app/widgets/padel/standings/StandingsWidgetClient.tsx");

    for (const content of [
      publicTables,
      monitor,
      score,
      widgetCalendar,
      widgetBracket,
      widgetNext,
      widgetStandings,
    ]) {
      expect(content).not.toContain("/api/padel/live");
      expect(content).toContain("/api/live/events/");
      expect(content).toContain("/stream");
    }
  });

  it("workspace de parcerias expõe cockpit operacional de claims + override contextual", () => {
    const workspace = readLocal("app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx");
    expect(workspace).toContain("createAndExecuteOverrideFromClaim");
    expect(workspace).toContain("Resolver via override");
    expect(workspace).toContain("updateClaimStatus");
    expect(workspace).toContain("conflictsOwner");
    expect(workspace).toContain("conflictsPartner");
  });

  it("remove chamadas legacy /organizacao no hub web padel", () => {
    const hub = readLocal("app/organizacao/(dashboard)/padel/PadelHubClient.tsx");
    const tabs = readLocal("app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx");
    expect(hub).not.toContain('"/api/organizacao');
    expect(hub).not.toContain('"/organizacao/padel');
    expect(hub).not.toContain('"/organizacao/reservas');
    expect(hub).toContain("/api/org/[orgId]");
    expect(tabs).not.toContain("/api/organizacao");
    expect(tabs).toContain("/api/org/[orgId]");
  });

  it("mantém wrappers canónicos /api/org/[orgId]/padel para operação e exports", () => {
    const analytics = readLocal("app/api/org/[orgId]/padel/analytics/route.ts");
    const waitlist = readLocal("app/api/org/[orgId]/padel/waitlist/route.ts");
    const waitlistPromote = readLocal("app/api/org/[orgId]/padel/waitlist/promote/route.ts");
    const imports = readLocal("app/api/org/[orgId]/padel/imports/inscritos/route.ts");
    const swap = readLocal("app/api/org/[orgId]/padel/pairings/swap/route.ts");
    const broadcast = readLocal("app/api/org/[orgId]/padel/broadcast/route.ts");
    const exportCalendario = readLocal("app/api/org/[orgId]/padel/exports/calendario/route.ts");
    const exportInscritos = readLocal("app/api/org/[orgId]/padel/exports/inscritos/route.ts");
    const exportResultados = readLocal("app/api/org/[orgId]/padel/exports/resultados/route.ts");
    const exportBracket = readLocal("app/api/org/[orgId]/padel/exports/bracket/route.ts");
    const exportAnalytics = readLocal("app/api/org/[orgId]/padel/exports/analytics/route.ts");

    for (const content of [
      analytics,
      waitlist,
      waitlistPromote,
      imports,
      swap,
      broadcast,
      exportCalendario,
      exportInscritos,
      exportResultados,
      exportBracket,
      exportAnalytics,
    ]) {
      expect(content).toContain('export * from "@/app/api/organizacao/padel/');
    }
  });
});
