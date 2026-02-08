import { describe, expect, it } from "vitest";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";

describe("agenda overlap filter", () => {
  it("builds overlap bounds when both from/to are present", () => {
    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-01-31T23:59:59Z");
    expect(buildAgendaOverlapFilter({ from, to })).toEqual({
      startsAt: { lte: to },
      endsAt: { gte: from },
    });
  });

  it("builds partial bounds when only from is present", () => {
    const from = new Date("2025-01-01T00:00:00Z");
    expect(buildAgendaOverlapFilter({ from })).toEqual({
      endsAt: { gte: from },
    });
  });

  it("builds partial bounds when only to is present", () => {
    const to = new Date("2025-01-31T23:59:59Z");
    expect(buildAgendaOverlapFilter({ to })).toEqual({
      startsAt: { lte: to },
    });
  });

  it("returns empty filter when no bounds are provided", () => {
    expect(buildAgendaOverlapFilter({})).toEqual({});
  });
});
