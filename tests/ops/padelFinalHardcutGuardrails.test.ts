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
    const live = readLocal("app/api/padel/live/route.ts");
    const widgetStandings = readLocal("app/api/widgets/padel/standings/route.ts");
    const mobileApi = readLocal("apps/mobile/features/tournaments/api.ts");
    const publicClient = readLocal("app/eventos/[slug]/PadelPublicTablesClient.tsx");

    expect(standings).toContain("entityType");
    expect(standings).toContain("rows");
    expect(standings).toContain("groups");
    expect(live).toContain("entityType");
    expect(widgetStandings).toContain("entityType");
    expect(widgetStandings).toContain("rows");
    expect(widgetStandings).toContain("groups");
    expect(mobileApi).toContain("PadelStandingEntityType");
    expect(mobileApi).toContain("rows: Array.isArray(unwrapped.rows) ? unwrapped.rows : []");
    expect(publicClient).toContain("initialEntityType");
  });

  it("mantém consistência de desempate determinístico no livehub padel", () => {
    const livehub = readLocal("app/api/livehub/[slug]/route.ts");
    expect(livehub).toContain("tieBreakRulesForPadelFormat");
    expect(livehub).toContain("drawOrderSeed");
    expect(livehub).toContain("computePadelStandingsByGroupForPlayers");
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

    expect(createPairing).toContain("ensurePadelRatingActionAllowed");
    expect(openPairing).toContain("ensurePadelRatingActionAllowed");
    expect(acceptPairing).toContain("ensurePadelRatingActionAllowed");
    expect(claimPairing).toContain("ensurePadelRatingActionAllowed");
    expect(claimPairing).toContain("error: ratingGate.error");
  });
});
