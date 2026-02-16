import { describe, expect, it } from "vitest";
import {
  computePadelStandingsByGroup,
  DEFAULT_PADEL_POINTS_TABLE,
  DEFAULT_PADEL_TIE_BREAK_RULES,
} from "@/domain/padel/standings";

describe("padel live standings exceptions", () => {
  it("aplica WALKOVER/RETIRED e ignora CANCELLED no cálculo", () => {
    const standings = computePadelStandingsByGroup(
      [
        {
          pairingAId: 1,
          pairingBId: 2,
          scoreSets: [],
          score: { resultType: "WALKOVER", winnerSide: "A" },
          status: "WALKOVER",
          groupLabel: "A",
        },
        {
          pairingAId: 2,
          pairingBId: 3,
          scoreSets: [],
          score: { resultType: "RETIREMENT", winnerSide: "A" },
          status: "RETIRED",
          groupLabel: "A",
        },
        {
          pairingAId: 1,
          pairingBId: 3,
          scoreSets: [],
          score: { resultType: "NORMAL" },
          status: "CANCELLED",
          groupLabel: "A",
        },
      ],
      DEFAULT_PADEL_POINTS_TABLE,
      DEFAULT_PADEL_TIE_BREAK_RULES,
      { drawOrderSeed: "live-standing-exceptions" },
    );

    const rows = standings.A;
    expect(rows).toHaveLength(3);
    expect(rows[0].pairingId).toBe(1);
    expect(rows[0].points).toBe(3);
    expect(rows[1].pairingId).toBe(2);
    expect(rows[1].points).toBe(3);
    expect(rows[2].pairingId).toBe(3);
    expect(rows[2].points).toBe(0);
  });
});
