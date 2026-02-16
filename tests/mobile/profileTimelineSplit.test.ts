import { describe, expect, it } from "vitest";
import type { AgendaItem } from "../../apps/mobile/features/profile/types";
import { splitAgendaTimeline } from "../../apps/mobile/features/profile/timeline";

const buildItem = (partial: Partial<AgendaItem> & { id: string; startAt: string }): AgendaItem => ({
  id: partial.id,
  type: partial.type ?? "EVENTO",
  title: partial.title ?? partial.id,
  startAt: partial.startAt,
  endAt: partial.endAt ?? null,
  coverImageUrl: partial.coverImageUrl ?? null,
  status: partial.status ?? null,
  label: partial.label ?? null,
  ctaHref: partial.ctaHref ?? null,
  ctaLabel: partial.ctaLabel ?? null,
});

describe("splitAgendaTimeline", () => {
  it("keeps upcoming items in active and past in history", () => {
    const now = new Date("2026-02-16T12:00:00.000Z");
    const items: AgendaItem[] = [
      buildItem({
        id: "booking-upcoming",
        type: "RESERVA",
        status: "CONFIRMED",
        startAt: "2026-02-17T12:00:00.000Z",
      }),
      buildItem({
        id: "event-past",
        type: "EVENTO",
        startAt: "2026-02-15T12:00:00.000Z",
      }),
      buildItem({
        id: "inscricao-upcoming",
        type: "INSCRICAO",
        startAt: "2026-02-18T12:00:00.000Z",
      }),
    ];

    const { active, history } = splitAgendaTimeline(items, now);

    expect(active.map((item) => item.id)).toEqual(["booking-upcoming", "inscricao-upcoming"]);
    expect(history.map((item) => item.id)).toEqual(["event-past"]);
  });

  it("forces terminal booking statuses into history", () => {
    const now = new Date("2026-02-16T12:00:00.000Z");
    const items: AgendaItem[] = [
      buildItem({
        id: "booking-completed-future",
        type: "RESERVA",
        status: "COMPLETED",
        startAt: "2026-02-18T12:00:00.000Z",
      }),
      buildItem({
        id: "booking-cancelled-future",
        type: "RESERVA",
        status: "CANCELLED_BY_CLIENT",
        startAt: "2026-02-19T12:00:00.000Z",
      }),
    ];

    const { active, history } = splitAgendaTimeline(items, now);

    expect(active).toHaveLength(0);
    expect(history.map((item) => item.id)).toEqual([
      "booking-cancelled-future",
      "booking-completed-future",
    ]);
  });
});
