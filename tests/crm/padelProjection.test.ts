import { describe, expect, it } from "vitest";
import {
  PADEL_MATCH_COUNT_INTERACTION_TYPES,
  derivePadelProjection,
  resolvePadelActivityStatus,
  resolvePadelCompetitiveTier,
} from "@/lib/crm/padelProjection";

describe("padel projection scoring", () => {
  it("classifica estado de atividade por recência", () => {
    expect(resolvePadelActivityStatus(3)).toBe("ACTIVE");
    expect(resolvePadelActivityStatus(14)).toBe("WARM");
    expect(resolvePadelActivityStatus(30)).toBe("COLD");
    expect(resolvePadelActivityStatus(90)).toBe("DORMANT");
    expect(resolvePadelActivityStatus(null)).toBe("DORMANT");
  });

  it("deriva tier competitivo com base em volume/nível/performance", () => {
    expect(
      resolvePadelCompetitiveTier({
        level: "4.7",
        tournamentsCount: 5,
        matches30d: 3,
        winRate90d: 0.45,
      }),
    ).toBe("COMPETITIVE");

    expect(
      resolvePadelCompetitiveTier({
        level: "3.6",
        tournamentsCount: 2,
        matches30d: 6,
        winRate90d: 0.52,
      }),
    ).toBe("ADVANCED");

    expect(
      resolvePadelCompetitiveTier({
        level: "2.8",
        tournamentsCount: 1,
        matches30d: 3,
        winRate90d: 0.4,
      }),
    ).toBe("INTERMEDIATE");
  });

  it("calcula scores elevados para jogador ativo e com no-show baixo", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const projection = derivePadelProjection({
      now,
      lastMatchAt: new Date("2026-02-27T12:00:00.000Z"),
      matches30d: 10,
      wins90d: 16,
      losses90d: 6,
      noShows90d: 1,
      tournamentsCount: 12,
      level: "4.1",
    });

    expect(projection.activityStatus).toBe("ACTIVE");
    expect(projection.competitiveTier).toBe("COMPETITIVE");
    expect(projection.rfmScore).toBeGreaterThanOrEqual(400);
    expect(projection.churnRiskScore).toBeLessThan(40);
    expect(projection.reactivationPropensityScore).toBeGreaterThan(50);
  });

  it("aumenta risco de churn quando recência e no-show degradam", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const projection = derivePadelProjection({
      now,
      lastMatchAt: new Date("2025-10-01T12:00:00.000Z"),
      matches30d: 0,
      wins90d: 0,
      losses90d: 0,
      noShows90d: 4,
      tournamentsCount: 1,
      level: null,
    });

    expect(projection.activityStatus).toBe("DORMANT");
    expect(projection.churnRiskScore).toBeGreaterThanOrEqual(70);
    expect(projection.reactivationPropensityScore).toBeGreaterThanOrEqual(0);
  });

  it("conta jogos de 30d apenas com PADEL_MATCH_PLAYED", () => {
    expect(PADEL_MATCH_COUNT_INTERACTION_TYPES).toEqual(["PADEL_MATCH_PLAYED"]);
  });
});
