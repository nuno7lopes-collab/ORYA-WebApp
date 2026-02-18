import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel player result submission surface", () => {
  it("wires player profile matches to result submission card", () => {
    const pageSource = readLocal("app/[username]/padel/page.tsx");

    expect(pageSource).toContain('from "./PadelResultSubmitCard"');
    expect(pageSource).toContain("<PadelResultSubmitCard");
    expect(pageSource).toContain("playerResultSubmissionEnabled");
    expect(pageSource).toContain("resultValidationMode");
  });

  it("keeps dedicated client component for player result submission", () => {
    const componentSource = readLocal("app/[username]/padel/PadelResultSubmitCard.tsx");

    expect(componentSource).toContain("/api/padel/matches/${matchId}/result/submit");
    expect(componentSource).toContain("MISSING_CLIENT_REQUEST_ID");
    expect(componentSource).toContain("PENDING_CONFIRMATION");
    expect(componentSource).toContain("TIMED_GAMES");
  });

  it("keeps me dashboard padel filters and profile operational summary wired", () => {
    const meSource = readLocal("app/me/page.tsx");
    const profileSource = readLocal("app/[username]/padel/page.tsx");

    expect(meSource).toContain("PADEL_STATUS_FILTER_OPTIONS");
    expect(meSource).toContain("padelMatchStatusFilter");
    expect(meSource).toContain("padelMatchCategoryFilter");
    expect(meSource).toContain("padelMatchEventFilter");
    expect(meSource).toContain("padelAttentionOnly");
    expect(meSource).toContain("resolveAttentionLabel");
    expect(meSource).toContain("/api/padel/me/matches?");
    expect(profileSource).toContain("padelOperationalSummary");
    expect(profileSource).toContain("padelAttentionMatches");
    expect(profileSource).toContain("Fila de atenção (jogador)");
    expect(profileSource).toContain("Ação jogador");
  });
});
