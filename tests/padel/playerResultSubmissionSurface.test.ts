import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel player result submission surface", () => {
  it("mantém indicadores de submissão do jogador no dashboard /me", () => {
    const meSource = readLocal("app/me/page.tsx");

    expect(meSource).toContain("playerCanSubmitResult");
    expect(meSource).toContain("playerSubmissionEnabled");
    expect(meSource).toContain("resultValidationMode");
    expect(meSource).toContain("Podes submeter resultado como jogador.");
  });

  it("keeps dedicated client component for player result submission", () => {
    const componentSource = readLocal("app/[username]/padel/PadelResultSubmitCard.tsx");

    expect(componentSource).toContain("/api/padel/matches/${matchId}/result/submit");
    expect(componentSource).toContain("MISSING_CLIENT_REQUEST_ID");
    expect(componentSource).toContain("PENDING_CONFIRMATION");
    expect(componentSource).toContain("TIMED_GAMES");
  });

  it("keeps me dashboard padel filters and operational summary wired", () => {
    const meSource = readLocal("app/me/page.tsx");
    const profileSource = readLocal("app/[username]/padel/page.tsx");

    expect(meSource).toContain("PADEL_STATUS_FILTER_OPTIONS");
    expect(meSource).toContain("padelMatchStatusFilter");
    expect(meSource).toContain("padelMatchCategoryFilter");
    expect(meSource).toContain("padelMatchEventFilter");
    expect(meSource).toContain("padelAttentionOnly");
    expect(meSource).toContain("resolveAttentionLabel");
    expect(meSource).toContain("/api/padel/me/matches?");
    expect(meSource).toContain("padelMatchesSummary.liveNow");
    expect(meSource).toContain("padelMatchesSummary.actionable");
    expect(meSource).toContain("padelMatchesSummary.requiresAttention");
    expect(profileSource).toContain("Próximos torneios");
    expect(profileSource).toContain("Top 3 clubes");
    expect(profileSource).toContain("Top 3 duplas");
  });
});
