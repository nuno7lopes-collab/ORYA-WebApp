import { describe, expect, it } from "vitest";
import {
  resolveAllowPlaceholderMatches,
  resolveMinParticipantsPerSide,
} from "@/domain/padel/schedulerV2/formatAdapters";

describe("padel format adapters", () => {
  it("permite placeholders em NON_STOP e em jogos NS", () => {
    expect(
      resolveAllowPlaceholderMatches({
        tournamentFormat: "NON_STOP",
        unscheduledMatches: [],
      }),
    ).toBe(true);

    expect(
      resolveAllowPlaceholderMatches({
        tournamentFormat: "TODOS_CONTRA_TODOS",
        unscheduledMatches: [
          {
            id: 1,
            plannedDurationMinutes: null,
            courtId: null,
            sideAProfileIds: [],
            sideBProfileIds: [],
            groupLabel: "NS",
          },
        ],
      }),
    ).toBe(true);
  });

  it("define mínimo por lado para formatos de padel sem placeholders", () => {
    expect(
      resolveMinParticipantsPerSide({
        tournamentFormat: "TODOS_CONTRA_TODOS",
        allowPlaceholderMatches: false,
      }),
    ).toBe(2);

    expect(
      resolveMinParticipantsPerSide({
        tournamentFormat: "UNKNOWN_FORMAT",
        allowPlaceholderMatches: false,
      }),
    ).toBe(1);

    expect(
      resolveMinParticipantsPerSide({
        tournamentFormat: "TODOS_CONTRA_TODOS",
        allowPlaceholderMatches: true,
      }),
    ).toBe(1);
  });
});
