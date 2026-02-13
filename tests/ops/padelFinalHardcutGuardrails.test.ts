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
    expect(undoRoute).toContain("winnerSide");
    expect(undoRoute).toContain("winnerParticipantId");
    expect(assignRoute).toContain("padelMatchParticipant");
    expect(assignRoute).toContain("winnerParticipantId");
  });

  it("remove dependência pairing-centric no scheduling canónico de calendário", () => {
    const calendarRoute = readLocal("app/api/padel/calendar/route.ts");
    expect(calendarRoute).toContain("resolveMatchPlayerProfileIds");
    expect(calendarRoute).toContain("resolveMatchUserIds");
    expect(calendarRoute).not.toContain("pairingAId");
    expect(calendarRoute).not.toContain("pairingBId");
    expect(calendarRoute).not.toContain("winnerPairingId");
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

  it("força rotação individual em AMERICANO/MEXICANO no gerador canónico", () => {
    const generator = readLocal("domain/padel/autoGenerateMatches.ts");
    expect(generator).toContain("NEED_PLAYERS_FOR_INDIVIDUAL_FORMAT");
    expect(generator).toContain("AUTO_ROTATION:");
    expect(generator).toContain("individual-rotation");
    expect(generator).toContain("resultType: \"BYE_NEUTRAL\"");
  });

  it("recompõe MEXICANO por performance na transição de ronda live", () => {
    const nextRound = readLocal("app/api/padel/live/timer/next-round/route.ts");
    const mexicanoDomain = readLocal("domain/padel/mexicanoRecomposition.ts");
    expect(nextRound).toContain("recomposeMexicanoForNextRound");
    expect(nextRound).toContain("computePadelStandingsByGroupForPlayers");
    expect(nextRound).toContain("deriveMexicanoRoundEntries");
    expect(nextRound).toContain("mexicanoRecomposition");
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
});
