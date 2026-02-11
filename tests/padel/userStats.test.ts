import { describe, expect, it } from "vitest";
import { computeUserPadelStats } from "@/domain/padel/userStats";

describe("computeUserPadelStats", () => {
  it("computes wins/losses from match scores", () => {
    const stats = computeUserPadelStats([
      {
        pairingSide: "A",
        status: "DONE",
        scoreSets: [
          { teamA: 6, teamB: 4 },
          { teamA: 6, teamB: 3 },
        ],
      },
      {
        pairingSide: "B",
        status: "DONE",
        scoreSets: [
          { teamA: 7, teamB: 5 },
          { teamA: 6, teamB: 3 },
        ],
      },
      {
        pairingSide: "A",
        status: "PENDING",
        scoreSets: [{ teamA: 6, teamB: 0 }],
      },
    ]);

    expect(stats.matchesPlayed).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(0.5);
  });
});
