import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOURNAMENT_MATCH_GUARD = "PADEL_TOURNAMENTMATCH_WRITE_FORBIDDEN";
const INTERCLUB_GUARD = "INTERCLUB_TEAM_ENGINE_REQUIRED";

const DOMAIN_WRITE_FILES = [
  "domain/tournaments/matchUpdate.ts",
  "domain/tournaments/generation.ts",
];

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel core guardrails (D18)", () => {
  it("bloqueia write direto em TournamentMatch para eventos Padel", () => {
    for (const file of DOMAIN_WRITE_FILES) {
      const content = readLocal(file);
      expect(content, file).toContain(TOURNAMENT_MATCH_GUARD);
    }
  });

  it("bloqueia geração auto interclub sem motor por equipas", () => {
    const content = readLocal("domain/padel/autoGenerateMatches.ts");
    expect(content).toContain(INTERCLUB_GUARD);
  });
});
