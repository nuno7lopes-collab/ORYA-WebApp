import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueNotification = vi.hoisted(() => vi.fn(async () => ({ id: "outbox" })));

vi.mock("@/domain/notifications/outbox", () => ({ enqueueNotification }));

let notifyMatchChanged: typeof import("@/domain/notifications/producer").notifyMatchChanged;

beforeEach(async () => {
  enqueueNotification.mockReset();
  enqueueNotification.mockResolvedValue({ id: "outbox" });
  vi.resetModules();
  ({ notifyMatchChanged } = await import("@/domain/notifications/producer"));
});

describe("padel live notifications producer", () => {
  it("inclui userId na dedupe key de MATCH_CHANGED", async () => {
    await notifyMatchChanged({
      userId: "user-a",
      matchId: 5,
      startAt: new Date("2026-02-16T10:00:00.000Z"),
      courtId: 2,
      scheduleVersion: "v1",
    });
    await notifyMatchChanged({
      userId: "user-b",
      matchId: 5,
      startAt: new Date("2026-02-16T10:00:00.000Z"),
      courtId: 2,
      scheduleVersion: "v1",
    });

    const dedupeA = enqueueNotification.mock.calls[0]?.[0]?.dedupeKey as string;
    const dedupeB = enqueueNotification.mock.calls[1]?.[0]?.dedupeKey as string;

    expect(dedupeA).not.toEqual(dedupeB);
    expect(dedupeA).toContain("user-a");
    expect(dedupeB).toContain("user-b");
  });
});

