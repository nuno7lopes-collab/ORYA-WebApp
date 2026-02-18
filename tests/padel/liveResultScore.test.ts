import { describe, expect, it } from "vitest";
import { DEFAULT_PADEL_SCORE_RULES } from "@/domain/padel/score";
import { resolveLiveResultScore } from "@/domain/padel/liveResultScore";

describe("padel live result score resolver", () => {
  it("normaliza timed games com empate permitido", () => {
    const result = resolveLiveResultScore({
      incomingScore: {
        mode: "TIMED_GAMES",
        gamesA: 6,
        gamesB: 6,
        allowDraw: true,
      },
      currentScoreSets: null,
      scoreRules: {
        ...DEFAULT_PADEL_SCORE_RULES,
        scoreMode: "TIMED_GAMES",
        allowTimedDraw: true,
      },
    });

    expect(result.hasScoreEvidence).toBe(true);
    expect(result.stats?.mode).toBe("TIMED_GAMES");
    expect(result.isDrawResult).toBe(true);
    expect(result.winnerSide).toBeNull();
    expect(result.nextScoreSets).toEqual([]);
  });

  it("marca inválido quando timed games traz empate não permitido", () => {
    const result = resolveLiveResultScore({
      incomingScore: {
        mode: "TIMED_GAMES",
        gamesA: 7,
        gamesB: 7,
        allowDraw: false,
      },
      currentScoreSets: null,
      scoreRules: {
        ...DEFAULT_PADEL_SCORE_RULES,
        scoreMode: "TIMED_GAMES",
        allowTimedDraw: false,
      },
    });

    expect(result.hasScoreEvidence).toBe(true);
    expect(result.stats).toBeNull();
  });

  it("mantém fallback winner quando não há sets/timed payload", () => {
    const result = resolveLiveResultScore({
      incomingScore: { resultType: "NORMAL" },
      currentScoreSets: null,
      fallbackWinnerSide: "B",
      scoreRules: DEFAULT_PADEL_SCORE_RULES,
    });

    expect(result.hasScoreEvidence).toBe(false);
    expect(result.winnerSide).toBe("B");
  });
});
