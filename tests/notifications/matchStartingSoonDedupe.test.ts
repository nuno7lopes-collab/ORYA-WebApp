import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyMatchChanged = vi.hoisted(() => vi.fn(async () => ({ id: "out-1" })));

const prisma = vi.hoisted(() => ({
  notificationOutbox: {
    findMany: vi.fn(async () => []),
  },
}));

vi.mock("@/domain/notifications/producer", () => ({
  notifyBracketPublished: vi.fn(),
  notifyChampion: vi.fn(),
  notifyEliminated: vi.fn(),
  notifyMatchChanged,
  notifyMatchResult: vi.fn(),
  notifyNextOpponent: vi.fn(),
  notifyTournamentEve: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

let queueMatchChanged: typeof import("@/domain/notifications/tournament").queueMatchChanged;

beforeEach(async () => {
  vi.resetModules();
  notifyMatchChanged.mockReset();
  notifyMatchChanged.mockResolvedValue({ id: "out-1" });
  prisma.notificationOutbox.findMany.mockReset();
  prisma.notificationOutbox.findMany.mockResolvedValue([]);
  ({ queueMatchChanged } = await import("@/domain/notifications/tournament"));
});

describe("queueMatchChanged dedupe para reminders live", () => {
  it("mantém dedupe estável para MATCH_STARTING_SOON com mesmo scheduleVersion/scheduledAt", async () => {
    const startAt = new Date("2026-02-22T10:15:00.000Z");
    const scheduledAt = new Date("2026-02-22T10:15:00.000Z");

    const key1 = await queueMatchChanged({
      userIds: ["u1"],
      matchId: 77,
      startAt,
      courtId: 3,
      scheduleVersion: "v1",
      eventType: "MATCH_STARTING_SOON",
      scheduledAt,
      priority: "CRITICAL",
    });

    const key2 = await queueMatchChanged({
      userIds: ["u1"],
      matchId: 77,
      startAt,
      courtId: 3,
      scheduleVersion: "v1",
      eventType: "MATCH_STARTING_SOON",
      scheduledAt,
      priority: "CRITICAL",
    });

    expect(key1).toBe(key2);
    expect(notifyMatchChanged).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "MATCH_STARTING_SOON", scheduledAt }),
    );
  });

  it("altera dedupe quando muda eventType ou scheduledAt", async () => {
    const startAt = new Date("2026-02-22T10:15:00.000Z");

    const keyStartingSoon = await queueMatchChanged({
      userIds: ["u1"],
      matchId: 77,
      startAt,
      courtId: 3,
      scheduleVersion: "v1",
      eventType: "MATCH_STARTING_SOON",
      scheduledAt: new Date("2026-02-22T10:15:00.000Z"),
    });

    const keyStream = await queueMatchChanged({
      userIds: ["u1"],
      matchId: 77,
      startAt,
      courtId: 3,
      scheduleVersion: "v1",
      eventType: "MATCH_STREAM_ONLINE",
      scheduledAt: new Date("2026-02-22T10:16:00.000Z"),
    });

    expect(keyStartingSoon).not.toBe(keyStream);
  });
});
