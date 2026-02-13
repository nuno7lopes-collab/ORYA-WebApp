import { describe, expect, it } from "vitest";
import {
  computePadelStandingsByGroup,
  computePadelStandingsByGroupForPlayers,
  DEFAULT_PADEL_POINTS_TABLE,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";

describe("padel standings timed formats", () => {
  it("aplica BYE_NEUTRAL com pontuação neutra", () => {
    const standings = computePadelStandingsByGroup(
      [
        {
          pairingAId: 10,
          pairingBId: null,
          scoreSets: [],
          score: { mode: "TIMED_GAMES", resultType: "BYE_NEUTRAL" },
          status: "DONE",
          groupLabel: "MX",
        },
      ],
      DEFAULT_PADEL_POINTS_TABLE,
      normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]),
    );

    expect(standings.MX).toHaveLength(1);
    expect(standings.MX[0].pairingId).toBe(10);
    expect(standings.MX[0].points).toBe(1);
    expect(standings.MX[0].draws).toBe(1);
  });

  it("suporta standings por jogador para AMERICANO/MEXICANO", () => {
    const pairingPlayers = new Map<number, number[]>([
      [1, [101, 102]],
      [2, [201, 202]],
    ]);
    const standings = computePadelStandingsByGroupForPlayers(
      [
        {
          pairingAId: 1,
          pairingBId: 2,
          scoreSets: [],
          score: { mode: "TIMED_GAMES", gamesA: 5, gamesB: 3 },
          status: "DONE",
          groupLabel: "AM",
        },
      ],
      pairingPlayers,
      DEFAULT_PADEL_POINTS_TABLE,
      normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]),
    );

    expect(standings.AM).toHaveLength(4);
    expect(standings.AM[0].points).toBeGreaterThan(standings.AM[2].points);
    expect(standings.AM[0].playerId).toBe(standings.AM[0].entityId);
  });
});
