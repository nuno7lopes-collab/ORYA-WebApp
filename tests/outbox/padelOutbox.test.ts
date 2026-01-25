import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePadelOutboxEvent } from "@/domain/padel/outbox";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAuditSafe: vi.fn(async () => ({})),
}));

let matchState: any = null;

vi.mock("@/lib/prisma", () => {
  const padelMatch = {
    update: vi.fn(({ data }: any) => {
      matchState = {
        ...matchState,
        ...data,
        score: data.score ?? matchState.score,
        plannedStartAt: data.plannedStartAt ?? matchState.plannedStartAt,
        plannedEndAt: data.plannedEndAt ?? matchState.plannedEndAt,
        plannedDurationMinutes: data.plannedDurationMinutes ?? matchState.plannedDurationMinutes,
        courtId: data.courtId ?? matchState.courtId,
      };
      return matchState;
    }),
    findUnique: vi.fn(() => matchState),
  };
  const prisma = {
    padelMatch,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("padel outbox consumer", () => {
  beforeEach(() => {
    matchState = {
      id: 1,
      eventId: 10,
      score: {},
      plannedStartAt: null,
      plannedEndAt: null,
      plannedDurationMinutes: null,
      courtId: null,
      event: {
        id: 10,
        organizationId: 99,
        startsAt: new Date(),
        endsAt: new Date(),
        padelTournamentConfig: { padelClubId: null, partnerClubIds: [], advancedSettings: {} },
      },
    };
    prismaMock.padelMatch.update.mockClear();
    prismaMock.padelMatch.findUnique.mockClear();
  });

  it("auto schedule aplica updates e é idempotente", async () => {
    await handlePadelOutboxEvent({
      eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
      payload: {
        eventId: 10,
        organizationId: 99,
        actorUserId: "u1",
        scheduledUpdates: [
          {
            matchId: 1,
            courtId: 7,
            start: new Date("2025-01-01T10:00:00Z").toISOString(),
            end: new Date("2025-01-01T11:00:00Z").toISOString(),
            durationMinutes: 60,
          },
        ],
      },
    });
    expect(matchState.courtId).toBe(7);
    expect(matchState.plannedDurationMinutes).toBe(60);

    await handlePadelOutboxEvent({
      eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
      payload: {
        eventId: 10,
        organizationId: 99,
        actorUserId: "u1",
        scheduledUpdates: [
          {
            matchId: 1,
            courtId: 7,
            start: new Date("2025-01-01T10:00:00Z").toISOString(),
            end: new Date("2025-01-01T11:00:00Z").toISOString(),
            durationMinutes: 60,
          },
        ],
      },
    });
    expect(matchState.courtId).toBe(7);
    expect(matchState.plannedDurationMinutes).toBe(60);
  });

  it("delay marca status sem reschedule e é idempotente", async () => {
    await handlePadelOutboxEvent({
      eventType: "PADEL_MATCH_DELAY_REQUESTED",
      payload: {
        matchId: 1,
        eventId: 10,
        organizationId: 99,
        actorUserId: "u1",
        autoReschedule: false,
        clearSchedule: true,
        reason: "rain",
      },
    });
    expect((matchState.score as any).delayStatus).toBe("DELAYED");

    await handlePadelOutboxEvent({
      eventType: "PADEL_MATCH_DELAY_REQUESTED",
      payload: {
        matchId: 1,
        eventId: 10,
        organizationId: 99,
        actorUserId: "u1",
        autoReschedule: false,
        clearSchedule: true,
        reason: "rain",
      },
    });
    expect((matchState.score as any).delayStatus).toBe("DELAYED");
  });
});
