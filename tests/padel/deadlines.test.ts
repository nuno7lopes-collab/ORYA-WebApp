import { describe, expect, it } from "vitest";
import { computeSplitDeadlineAt } from "@/domain/padelDeadlines";

const toIso = (date: Date) => date.toISOString();

describe("padel deadlines (D12)", () => {
  it("uses 48h when event is far away", () => {
    const invitedAt = new Date("2026-02-01T10:00:00.000Z");
    const eventStartsAt = new Date("2026-02-10T10:00:00.000Z");
    const deadline = computeSplitDeadlineAt(invitedAt, eventStartsAt, 48);
    const expected = new Date("2026-02-03T10:00:00.000Z");
    expect(toIso(deadline)).toBe(toIso(expected));
  });

  it("uses T-24 when event is near", () => {
    const invitedAt = new Date("2026-02-01T10:00:00.000Z");
    const eventStartsAt = new Date("2026-02-02T16:00:00.000Z");
    const deadline = computeSplitDeadlineAt(invitedAt, eventStartsAt, 48);
    const expected = new Date("2026-02-01T16:00:00.000Z");
    expect(toIso(deadline)).toBe(toIso(expected));
  });

  it("falls back to invite deadline when event start is invalid", () => {
    const invitedAt = new Date("2026-02-01T10:00:00.000Z");
    const deadline = computeSplitDeadlineAt(invitedAt, null, 48);
    const expected = new Date("2026-02-03T10:00:00.000Z");
    expect(toIso(deadline)).toBe(toIso(expected));
  });
});
