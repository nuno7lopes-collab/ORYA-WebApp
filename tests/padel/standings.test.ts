import { describe, expect, it } from "vitest";
import {
  computePadelStandingsByGroup,
  DEFAULT_PADEL_POINTS_TABLE,
  DEFAULT_PADEL_TIE_BREAK_RULES,
} from "@/domain/padel/standings";

describe("padel standings", () => {
  it("orders by points and head-to-head", () => {
    const matches = [
      {
        pairingAId: 1,
        pairingBId: 2,
        scoreSets: [
          { teamA: 6, teamB: 4 },
          { teamA: 6, teamB: 4 },
        ],
        score: {},
        status: "DONE",
        groupLabel: "A",
      },
      {
        pairingAId: 2,
        pairingBId: 3,
        scoreSets: [
          { teamA: 6, teamB: 4 },
          { teamA: 6, teamB: 4 },
        ],
        score: {},
        status: "DONE",
        groupLabel: "A",
      },
      {
        pairingAId: 1,
        pairingBId: 3,
        scoreSets: [],
        score: {},
        status: "PENDING",
        groupLabel: "A",
      },
    ];

    const standings = computePadelStandingsByGroup(
      matches,
      DEFAULT_PADEL_POINTS_TABLE,
      DEFAULT_PADEL_TIE_BREAK_RULES,
    );
    const groupA = standings.A;
    expect(groupA.length).toBe(3);
    expect(groupA[0].pairingId).toBe(1);
    expect(groupA[1].pairingId).toBe(2);
    expect(groupA[2].pairingId).toBe(3);
  });

  it("ignores matches not DONE", () => {
    const standings = computePadelStandingsByGroup(
      [
        {
          pairingAId: 1,
          pairingBId: 2,
          scoreSets: [{ teamA: 6, teamB: 4 }],
          score: {},
          status: "PENDING",
          groupLabel: "A",
        },
      ],
      DEFAULT_PADEL_POINTS_TABLE,
      DEFAULT_PADEL_TIE_BREAK_RULES,
    );
    expect(standings.A[0].points).toBe(0);
  });
});
