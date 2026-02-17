import { describe, expect, it } from "vitest";
import { padel_format } from "@prisma/client";
import { computePadelPlan, estimateMaxTeamsForSlotsByFormat } from "@/domain/padel/formatEngine/capacity";
import { PADEL_FORMAT_ENGINE_REGISTRY } from "@/domain/padel/formatEngine/registry";

const WINDOW_START = "2026-02-17T09:00:00.000Z";
const WINDOW_END = "2026-02-17T23:00:00.000Z";

type BasePlanInput = Parameters<typeof computePadelPlan>[0];

function buildPlan(input: Partial<BasePlanInput> & Pick<BasePlanInput, "format">) {
  return computePadelPlan({
    format: input.format,
    teams: input.teams ?? 8,
    windowStart: input.windowStart ?? WINDOW_START,
    windowEnd: input.windowEnd ?? WINDOW_END,
    durationMinutes: input.durationMinutes ?? 30,
    bufferMinutes: input.bufferMinutes ?? 0,
    courtsCount: input.courtsCount ?? 10,
    categories: input.categories,
    categoryWeights: input.categoryWeights,
    roundsHint: input.roundsHint,
    groupCount: input.groupCount,
    groupSize: input.groupSize,
    qualifyPerGroup: input.qualifyPerGroup,
    extraQualifiers: input.extraQualifiers,
  });
}

describe("format engine matrix", () => {
  it("estimates matches across supported formats", () => {
    const cases: Array<{
      format: padel_format;
      teams: number;
      expectedMatches: number;
      categories?: BasePlanInput["categories"];
      groupCount?: number;
      qualifyPerGroup?: number;
      extraQualifiers?: number;
      roundsHint?: number;
      courtsCount?: number;
    }> = [
      { format: padel_format.TODOS_CONTRA_TODOS, teams: 6, expectedMatches: 15 },
      { format: padel_format.CAMPEONATO_LIGA, teams: 6, expectedMatches: 15 },
      { format: padel_format.QUADRO_ELIMINATORIO, teams: 10, expectedMatches: 15 },
      { format: padel_format.QUADRO_AB, teams: 8, expectedMatches: 10 },
      { format: padel_format.DUPLA_ELIMINACAO, teams: 8, expectedMatches: 15 },
      {
        format: padel_format.GRUPOS_ELIMINATORIAS,
        teams: 16,
        expectedMatches: 31,
        groupCount: 4,
        qualifyPerGroup: 2,
        extraQualifiers: 0,
      },
      { format: padel_format.NON_STOP, teams: 10, expectedMatches: 30, courtsCount: 5, roundsHint: 6 },
      {
        format: padel_format.AMERICANO,
        teams: 10,
        expectedMatches: 95,
        categories: [{ teams: 10, format: padel_format.AMERICANO, amMxMode: "INDIVIDUAL_ROTATION" }],
      },
      {
        format: padel_format.AMERICANO,
        teams: 10,
        expectedMatches: 45,
        categories: [{ teams: 10, format: padel_format.AMERICANO, amMxMode: "FIXED_PAIR" }],
      },
      {
        format: padel_format.MEXICANO,
        teams: 10,
        expectedMatches: 30,
        categories: [{ teams: 10, format: padel_format.MEXICANO, amMxMode: "INDIVIDUAL_ROTATION" }],
      },
      {
        format: padel_format.MEXICANO,
        teams: 10,
        expectedMatches: 45,
        categories: [{ teams: 10, format: padel_format.MEXICANO, amMxMode: "FIXED_PAIR" }],
      },
    ];

    for (const testCase of cases) {
      const plan = buildPlan({
        format: testCase.format,
        teams: testCase.teams,
        categories: testCase.categories,
        groupCount: testCase.groupCount,
        qualifyPerGroup: testCase.qualifyPerGroup,
        extraQualifiers: testCase.extraQualifiers,
        roundsHint: testCase.roundsHint,
        courtsCount: testCase.courtsCount ?? 10,
      });
      expect(plan.categories[0]?.matchesNeeded).toBe(testCase.expectedMatches);
    }
  });

  it("enforces minimum teams by format", () => {
    const formats = Object.keys(PADEL_FORMAT_ENGINE_REGISTRY) as padel_format[];
    for (const format of formats) {
      const minTeams = PADEL_FORMAT_ENGINE_REGISTRY[format].minTeams;
      const plan = buildPlan({
        format,
        teams: Math.max(0, minTeams - 1),
      });

      expect(plan.feasible).toBe(false);
      expect(plan.blockingReasons).toContain("MIN_TEAMS_NOT_MET:category:1");
      expect(plan.categories[0]?.minTeams).toBe(minTeams);
    }
  });

  it("applies slot allocation weights between categories", () => {
    const plan = computePadelPlan({
      format: padel_format.TODOS_CONTRA_TODOS,
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T14:00:00.000Z",
      durationMinutes: 30,
      bufferMinutes: 0,
      courtsCount: 2,
      categories: [
        { categoryId: 1, label: "A", teams: 8, format: padel_format.TODOS_CONTRA_TODOS },
        { categoryId: 2, label: "B", teams: 8, format: padel_format.TODOS_CONTRA_TODOS },
      ],
      categoryWeights: {
        "1": 3,
        "2": 1,
      },
    });

    const categoryA = plan.categories.find((category) => category.categoryId === 1);
    const categoryB = plan.categories.find((category) => category.categoryId === 2);
    expect(categoryA?.allocatedSlots).toBe(15);
    expect(categoryB?.allocatedSlots).toBe(5);
  });

  it("returns alternatives for infeasible plans", () => {
    const plan = buildPlan({
      format: padel_format.NON_STOP,
      teams: 20,
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T11:00:00.000Z",
      durationMinutes: 60,
      bufferMinutes: 0,
      courtsCount: 2,
      roundsHint: 6,
    });

    expect(plan.feasible).toBe(false);
    expect(plan.blockingReasons).toContain("INSUFFICIENT_CAPACITY");
    expect(plan.alternatives.some((alternative) => alternative.type === "ADD_HOURS")).toBe(true);
    expect(plan.alternatives.some((alternative) => alternative.type === "ADD_COURTS")).toBe(true);
    expect(plan.alternatives.some((alternative) => alternative.type === "REDUCE_TEAMS")).toBe(true);
    expect(plan.categories[0]?.recommendedMaxTeams).toBe(4);
  });

  it("estimates max teams by format for a slot budget", () => {
    expect(
      estimateMaxTeamsForSlotsByFormat({
        format: padel_format.TODOS_CONTRA_TODOS,
        totalSlots: 6,
        courts: 1,
      }),
    ).toBe(4);

    expect(
      estimateMaxTeamsForSlotsByFormat({
        format: padel_format.QUADRO_ELIMINATORIO,
        totalSlots: 7,
        courts: 1,
      }),
    ).toBe(8);

    expect(
      estimateMaxTeamsForSlotsByFormat({
        format: padel_format.NON_STOP,
        totalSlots: 100,
        courts: 5,
      }),
    ).toBe(10);
  });
});
