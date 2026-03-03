import { describe, expect, it } from "vitest";
import { buildMonthGridWindow, getEventsForDay } from "@/app/org/[orgId]/calendar/_components/month/helpers";
import type { AgendaItem } from "@/app/org/[orgId]/calendar/_components/day/types";
import { buildZonedDate } from "@/app/org/[orgId]/calendar/_components/day/helpers";

describe("month view helpers", () => {
  it("constrói janela mensal com grelha alinhada por semanas", () => {
    const window = buildMonthGridWindow({ year: 2026, month: 3 }, "Europe/Lisbon");
    expect(window.rows.length).toBeGreaterThanOrEqual(4);
    expect(window.rows.length).toBeLessThanOrEqual(6);
    const totalCells = window.rows.length * 7;
    const diffDays = Math.round(
      (window.gridEndExclusive.getTime() - window.gridStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(diffDays).toBe(totalCells);
  });

  it("retorna eventos sobrepostos ao dia selecionado", () => {
    const day = buildZonedDate({ year: 2026, month: 3, day: 3 }, "UTC", 12, 0);
    const events: AgendaItem[] = [
      {
        kind: "RESERVATION",
        reservationId: 1,
        title: "Treino",
        startsAt: "2026-03-03T10:00:00.000Z",
        endsAt: "2026-03-03T11:00:00.000Z",
        status: "CONFIRMED",
      },
      {
        kind: "EVENT",
        eventId: 2,
        title: "Outro dia",
        startsAt: "2026-03-04T10:00:00.000Z",
        endsAt: "2026-03-04T11:00:00.000Z",
        status: "PUBLISHED",
      },
    ];

    const dayEvents = getEventsForDay(events, day, "UTC");
    expect(dayEvents).toHaveLength(1);
    expect(dayEvents[0]?.title).toBe("Treino");
  });
});
