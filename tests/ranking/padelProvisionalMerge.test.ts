import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => ({ id: "log-ranking-1" })),
}));

vi.mock("@/domain/crm/outbox", () => ({
  recordCrmIngestOutbox: vi.fn(async () => ({})),
}));

import { ensurePadelPlayerProfileId } from "@/domain/padel/playerProfile";

function buildTx() {
  return {
    padelPlayerProfile: {
      findFirst: vi.fn(),
      update: vi.fn(async () => ({ id: 10 })),
      create: vi.fn(),
      delete: vi.fn(async () => ({ id: 99 })),
    },
    profile: {
      findUnique: vi.fn(async () => ({
        fullName: "Jogador Canonico",
        contactPhone: null,
        gender: null,
        padelLevel: "4.0",
        padelPreferredSide: null,
        padelClubName: null,
      })),
    },
    users: {
      findUnique: vi.fn(async () => ({ email: "claim@example.com" })),
    },
    padelPairingSlot: { updateMany: vi.fn(async () => ({ count: 0 })) },
    calendarAvailability: { updateMany: vi.fn(async () => ({ count: 0 })) },
    crmContactPadel: { updateMany: vi.fn(async () => ({ count: 0 })) },
    padelRankingEntry: {
      updateMany: vi.fn(async () => ({ count: 3 })),
      aggregate: vi.fn(async () => ({ _max: { createdAt: new Date() } })),
    },
    padelRatingEvent: {
      updateMany: vi.fn(async () => ({ count: 4 })),
      aggregate: vi.fn(async () => ({ _max: { createdAt: new Date() } })),
    },
    padelRatingSanction: { updateMany: vi.fn(async () => ({ count: 1 })) },
    padelTournamentParticipant: {
      aggregate: vi.fn(async () => ({ _max: { createdAt: new Date() } })),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      update: vi.fn(),
      delete: vi.fn(),
    },
    padelMatchParticipant: { updateMany: vi.fn(async () => ({ count: 0 })) },
    eventMatchSlot: { updateMany: vi.fn(async () => ({ count: 0 })) },
    padelRatingProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          id: 201,
          playerId: 10,
          rating: 1200,
          rd: 70,
          sigma: 0.06,
          tau: 0.5,
          matchesPlayed: 10,
          leaderboardEligible: true,
          blockedNewMatches: false,
          suspensionEndsAt: null,
          lastMatchAt: new Date("2026-01-15T00:00:00.000Z"),
          lastActivityAt: new Date("2026-01-15T00:00:00.000Z"),
          lastRebuildAt: new Date("2026-01-15T00:00:00.000Z"),
          metadata: {},
        })
        .mockResolvedValueOnce({
          id: 202,
          playerId: 99,
          rating: 1400,
          rd: 90,
          sigma: 0.07,
          tau: 0.6,
          matchesPlayed: 5,
          leaderboardEligible: true,
          blockedNewMatches: false,
          suspensionEndsAt: null,
          lastMatchAt: new Date("2026-02-10T00:00:00.000Z"),
          lastActivityAt: new Date("2026-02-10T00:00:00.000Z"),
          lastRebuildAt: new Date("2026-02-10T00:00:00.000Z"),
          metadata: {},
        }),
      update: vi.fn(async () => ({ id: 201 })),
      delete: vi.fn(async () => ({ id: 202 })),
    },
    eventLog: {
      create: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  } as any;
}

describe("padel ranking provisional merge (B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("migra histórico de ranking/rating do perfil provisório para o canónico", async () => {
    const tx = buildTx();

    tx.padelPlayerProfile.findFirst
      .mockResolvedValueOnce({
        id: 10,
        fullName: "Conta",
        displayName: "Conta",
        email: "claim@example.com",
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
      })
      .mockResolvedValueOnce({
        id: 99,
        fullName: "Provisorio",
        displayName: "Provisorio",
        email: "claim@example.com",
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
      });

    const profileId = await ensurePadelPlayerProfileId(tx, {
      organizationId: 7,
      userId: "user-1",
      claimKey: "PAIRING_CLAIM:444:user-1",
      retroactiveClaimMonths: 6,
    });

    expect(profileId).toBe(10);
    expect(tx.padelRankingEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 7, playerId: 99 },
        data: { playerId: 10 },
      }),
    );
    expect(tx.padelRatingEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 7, playerId: 99 },
        data: { playerId: 10 },
      }),
    );
    const ratingUpdateCall = tx.padelRatingProfile.update.mock.calls.find(
      (entry: any[]) => entry?.[0]?.where?.id === 201,
    );
    expect(ratingUpdateCall).toBeTruthy();
    expect(ratingUpdateCall?.[0]?.data?.matchesPlayed).toBe(15);
    expect(ratingUpdateCall?.[0]?.data?.rating).toBeCloseTo((1200 * 10 + 1400 * 5) / 15, 6);
    expect(tx.padelPlayerProfile.delete).toHaveBeenCalledWith({ where: { id: 99 } });
  });
});
