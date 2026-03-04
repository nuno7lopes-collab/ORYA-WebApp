import { beforeEach, describe, expect, it, vi } from "vitest";

const updatePadelMatch = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelScheduleRun: { update: vi.fn() },
  padelScheduleRunDecision: { updateMany: vi.fn(), create: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/domain/padel/matches/commands", () => ({ updatePadelMatch }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

const prismaMock = vi.mocked(prisma);
const updatePadelMatchMock = vi.mocked(updatePadelMatch);

describe("padel outbox auto-schedule stale version handling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    const tx = {
      padelScheduleRunDecision: {
        updateMany: prismaMock.padelScheduleRunDecision.updateMany,
        create: prismaMock.padelScheduleRunDecision.create,
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prismaMock.padelScheduleRunDecision.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.eventMatchSlot.findMany.mockResolvedValue([
      {
        id: 11,
        categoryId: 10,
        updatedAt: new Date("2026-03-03T12:05:00.000Z"),
      },
    ] as any);
  });

  it("não aplica jogo stale, regista STALE_MATCH_VERSION e fecha run em DONE parcial", async () => {
    updatePadelMatchMock.mockImplementation(async (input: { matchId: number }) => {
      if (input.matchId === 11) {
        throw new Error("MATCH_STALE_VERSION");
      }
      return { match: { id: input.matchId }, outboxEventId: "evt_ok" } as any;
    });

    const { handlePadelOutboxEvent } = await import("@/domain/padel/outbox");
    const result = await handlePadelOutboxEvent({
      eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
      payload: {
        runId: "run-1",
        eventId: 44,
        organizationId: 101,
        actorUserId: "admin-1",
        skipped: [],
        unscheduledByReason: {},
        byCategory: [{ categoryId: 10, scheduledCount: 2, skippedCount: 0, unscheduledByReason: {} }],
        scheduledUpdates: [
          {
            matchId: 11,
            courtId: 7,
            start: "2026-03-03T13:00:00.000Z",
            end: "2026-03-03T14:00:00.000Z",
            durationMinutes: 60,
            expectedUpdatedAt: "2026-03-03T12:00:00.000Z",
          },
          {
            matchId: 12,
            courtId: 7,
            start: "2026-03-03T14:00:00.000Z",
            end: "2026-03-03T15:00:00.000Z",
            durationMinutes: 60,
            expectedUpdatedAt: "2026-03-03T12:00:00.000Z",
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(updatePadelMatchMock).toHaveBeenCalledTimes(2);
    expect(updatePadelMatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: 11,
        expectedUpdatedAt: "2026-03-03T12:00:00.000Z",
      }),
    );
    expect(prismaMock.padelScheduleRunDecision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          runId: "run-1",
          matchId: 11,
          decisionType: "SCHEDULED",
        }),
        data: expect.objectContaining({
          decisionType: "SKIPPED",
          reason: "STALE_MATCH_VERSION",
        }),
      }),
    );

    const finalRunUpdate = prismaMock.padelScheduleRun.update.mock.calls.at(-1)?.[0];
    expect(finalRunUpdate?.where).toEqual({ id: "run-1" });
    expect(finalRunUpdate?.data?.status).toBe("DONE");
    expect(finalRunUpdate?.data?.scheduledCount).toBe(1);
    expect(finalRunUpdate?.data?.skippedCount).toBe(1);
    expect(finalRunUpdate?.data?.applied).toBe(true);
    expect((finalRunUpdate?.data?.unscheduledByReason as Record<string, unknown>)?.STALE_MATCH_VERSION).toBe(1);
  });
});

