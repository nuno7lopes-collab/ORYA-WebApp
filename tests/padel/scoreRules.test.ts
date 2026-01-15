import { describe, expect, it } from "vitest";
import { computePadelMatchStats, DEFAULT_PADEL_SCORE_RULES } from "@/domain/padel/score";

describe("padel score rules", () => {
  it("accepts standard best-of-3 results", () => {
    const stats = computePadelMatchStats(
      [
        { teamA: 6, teamB: 3 },
        { teamA: 6, teamB: 4 },
      ],
      DEFAULT_PADEL_SCORE_RULES,
    );
    expect(stats).not.toBeNull();
    expect(stats?.winner).toBe("A");
    expect(stats?.aSets).toBe(2);
    expect(stats?.bSets).toBe(0);
  });

  it("accepts a tie-break set", () => {
    const stats = computePadelMatchStats(
      [
        { teamA: 7, teamB: 6 },
        { teamA: 6, teamB: 4 },
      ],
      DEFAULT_PADEL_SCORE_RULES,
    );
    expect(stats).not.toBeNull();
    expect(stats?.winner).toBe("A");
  });

  it("rejects invalid set scores", () => {
    const stats = computePadelMatchStats(
      [
        { teamA: 6, teamB: 5 },
        { teamA: 6, teamB: 4 },
      ],
      DEFAULT_PADEL_SCORE_RULES,
    );
    expect(stats).toBeNull();
  });

  it("accepts a super tie-break decider", () => {
    const stats = computePadelMatchStats(
      [
        { teamA: 6, teamB: 4 },
        { teamA: 4, teamB: 6 },
        { teamA: 10, teamB: 8 },
      ],
      DEFAULT_PADEL_SCORE_RULES,
    );
    expect(stats).not.toBeNull();
    expect(stats?.winner).toBe("A");
  });

  it("rejects super tie-break outside the decider", () => {
    const stats = computePadelMatchStats(
      [
        { teamA: 10, teamB: 8 },
        { teamA: 6, teamB: 4 },
      ],
      DEFAULT_PADEL_SCORE_RULES,
    );
    expect(stats).toBeNull();
  });
});
