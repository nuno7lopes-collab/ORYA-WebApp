import { describe, expect, it } from "vitest";
import { buildAggregateAgendaItems } from "@/app/org/[orgId]/calendar/_components/week/aggregation";

type Item = { id: string };

function buildPosition(id: string, startMinute: number, endMinute: number) {
  const start = new Date(Date.UTC(2026, 1, 17, Math.floor(startMinute / 60), startMinute % 60));
  const end = new Date(Date.UTC(2026, 1, 17, Math.floor(endMinute / 60), endMinute % 60));
  return {
    item: { id } satisfies Item,
    start,
    end,
    startMinute,
    endMinute,
  };
}

describe("calendar agenda aggregation", () => {
  it("merges chained overlaps into one aggregate slot", () => {
    const positions = [
      buildPosition("one", 10 * 60, 10 * 60 + 20),
      buildPosition("three", 10 * 60 + 10, 10 * 60 + 35),
      buildPosition("two", 10 * 60 + 15, 10 * 60 + 20),
    ];

    const aggregated = buildAggregateAgendaItems({
      positions,
      dayKey: "2026-02-17",
      minuteHeight: 1,
    });

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.startMinute).toBe(10 * 60);
    expect(aggregated[0]?.endMinute).toBe(10 * 60 + 35);
    expect(aggregated[0]?.items).toHaveLength(3);
  });

  it("keeps separate slots when items do not overlap", () => {
    const positions = [
      buildPosition("one", 9 * 60, 9 * 60 + 30),
      buildPosition("two", 9 * 60 + 30, 10 * 60),
      buildPosition("three", 11 * 60, 11 * 60 + 15),
    ];

    const aggregated = buildAggregateAgendaItems({
      positions,
      dayKey: "2026-02-17",
      minuteHeight: 1,
    });

    expect(aggregated).toHaveLength(3);
    expect(aggregated.map((entry) => [entry.startMinute, entry.endMinute])).toEqual([
      [9 * 60, 9 * 60 + 30],
      [9 * 60 + 30, 10 * 60],
      [11 * 60, 11 * 60 + 15],
    ]);
  });
});
