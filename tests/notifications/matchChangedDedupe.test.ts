import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueNotification = vi.hoisted(() => vi.fn(async (input) => ({ id: "out-1", ...input })));

vi.mock("@/domain/notifications/outbox", () => ({
  enqueueNotification,
}));

import { notifyMatchChanged } from "@/domain/notifications/producer";

describe("notifyMatchChanged dedupe", () => {
  beforeEach(() => {
    enqueueNotification.mockReset();
    enqueueNotification.mockResolvedValue({ id: "out-1" });
  });

  it("usa scheduleVersion no dedupeKey e mantém payload reason/delayStatus", async () => {
    await notifyMatchChanged({
      userId: "u1",
      matchId: 50,
      startAt: new Date("2026-02-13T15:30:00.000Z"),
      courtId: 3,
      scheduleVersion: "v1",
      reason: "chuva",
      delayStatus: "RESCHEDULED",
    });
    await notifyMatchChanged({
      userId: "u1",
      matchId: 50,
      startAt: new Date("2026-02-13T15:30:00.000Z"),
      courtId: 3,
      scheduleVersion: "v1",
      reason: "chuva",
      delayStatus: "RESCHEDULED",
    });
    await notifyMatchChanged({
      userId: "u1",
      matchId: 50,
      startAt: new Date("2026-02-13T15:30:00.000Z"),
      courtId: 3,
      scheduleVersion: "v2",
      reason: "chuva",
      delayStatus: "RESCHEDULED",
    });

    const first = enqueueNotification.mock.calls[0][0];
    const second = enqueueNotification.mock.calls[1][0];
    const third = enqueueNotification.mock.calls[2][0];

    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(first.dedupeKey).not.toBe(third.dedupeKey);
    expect(first.payload).toMatchObject({
      scheduleVersion: "v1",
      reason: "chuva",
      delayStatus: "RESCHEDULED",
    });
  });
});
