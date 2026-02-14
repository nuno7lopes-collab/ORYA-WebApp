import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => ({ id: "log-1" })),
}));

vi.mock("@/domain/crm/outbox", () => ({
  recordCrmIngestOutbox: vi.fn(async () => ({})),
}));

import {
  ensurePadelPlayerProfileId,
  isPadelClaimWindowExpiredError,
} from "@/domain/padel/playerProfile";

function buildTx() {
  return {
    padelPlayerProfile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    users: {
      findUnique: vi.fn(),
    },
    padelPairingSlot: { updateMany: vi.fn() },
    calendarAvailability: { updateMany: vi.fn() },
    crmContactPadel: { updateMany: vi.fn() },
    padelRankingEntry: { updateMany: vi.fn(), aggregate: vi.fn() },
    padelRatingEvent: { updateMany: vi.fn(), aggregate: vi.fn() },
    padelRatingSanction: { updateMany: vi.fn() },
    padelTournamentParticipant: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    padelMatchParticipant: { updateMany: vi.fn() },
    eventMatchSlot: { updateMany: vi.fn() },
    padelRatingProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe("ensurePadelPlayerProfileId (claim merge)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("faz merge do perfil provisório para o perfil existente do utilizador de forma idempotente", async () => {
    const tx = buildTx();

    tx.padelPlayerProfile.findFirst
      .mockResolvedValueOnce({
        id: 10,
        fullName: "Conta",
        displayName: "Conta",
        email: "user@example.com",
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
        email: "user@example.com",
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
      })
      .mockResolvedValueOnce(null);

    tx.profile.findUnique.mockResolvedValue({
      fullName: "User Final",
      contactPhone: "+351000000000",
      gender: "MALE",
      padelLevel: "4",
      padelPreferredSide: "DIREITA",
      padelClubName: "Club A",
    });
    tx.users.findUnique.mockResolvedValue({ email: "user@example.com" });

    tx.padelRatingEvent.aggregate.mockResolvedValue({ _max: { createdAt: new Date() } });
    tx.padelTournamentParticipant.aggregate.mockResolvedValue({ _max: { createdAt: new Date() } });
    tx.padelRankingEntry.aggregate.mockResolvedValue({ _max: { createdAt: new Date() } });

    tx.padelTournamentParticipant.findMany.mockResolvedValue([
      { id: 101, eventId: 33, categoryId: 2 },
    ]);
    tx.padelTournamentParticipant.findFirst.mockResolvedValue(null);

    tx.padelRatingProfile.findUnique
      .mockResolvedValueOnce({
        id: 201,
        playerId: 10,
        rating: 1250,
        rd: 60,
        sigma: 0.06,
        tau: 0.5,
        matchesPlayed: 20,
        leaderboardEligible: true,
        blockedNewMatches: false,
        suspensionEndsAt: null,
        lastMatchAt: new Date(),
        lastActivityAt: new Date(),
        lastRebuildAt: new Date(),
        metadata: {},
      })
      .mockResolvedValueOnce({
        id: 202,
        playerId: 99,
        rating: 1300,
        rd: 80,
        sigma: 0.07,
        tau: 0.6,
        matchesPlayed: 12,
        leaderboardEligible: true,
        blockedNewMatches: false,
        suspensionEndsAt: null,
        lastMatchAt: new Date(),
        lastActivityAt: new Date(),
        lastRebuildAt: new Date(),
        metadata: {},
      });

    tx.padelPlayerProfile.update.mockResolvedValue({ id: 10 });
    tx.padelPlayerProfile.delete.mockResolvedValue({ id: 99 });

    const playerProfileId = await ensurePadelPlayerProfileId(tx, {
      organizationId: 7,
      userId: "user-1",
      claimKey: "PAIRING_CLAIM:44:user-1",
      retroactiveClaimMonths: 6,
    });

    expect(playerProfileId).toBe(10);
    expect(tx.padelPairingSlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerProfileId: 99 },
        data: { playerProfileId: 10, profileId: "user-1" },
      }),
    );
    expect(tx.padelRatingEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 7, playerId: 99 }, data: { playerId: 10 } }),
    );
    expect(tx.padelTournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 101 }, data: { playerProfileId: 10 } }),
    );
  });

  it("falha com CLAIM_WINDOW_EXPIRED quando a atividade competitiva é mais antiga que 6 meses", async () => {
    const tx = buildTx();
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - 8);

    tx.padelPlayerProfile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 33,
        fullName: "Provisorio",
        displayName: "Provisorio",
        email: "late@example.com",
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
      });
    tx.profile.findUnique.mockResolvedValue({
      fullName: "Late User",
      contactPhone: null,
      gender: null,
      padelLevel: null,
      padelPreferredSide: null,
      padelClubName: null,
    });
    tx.users.findUnique.mockResolvedValue({ email: "late@example.com" });
    tx.padelRatingEvent.aggregate.mockResolvedValue({ _max: { createdAt: staleDate } });
    tx.padelTournamentParticipant.aggregate.mockResolvedValue({ _max: { createdAt: null } });
    tx.padelRankingEntry.aggregate.mockResolvedValue({ _max: { createdAt: null } });

    await expect(
      ensurePadelPlayerProfileId(tx, {
        organizationId: 7,
        userId: "late-user",
        claimKey: "PAIRING_CLAIM:55:late-user",
        retroactiveClaimMonths: 6,
      }),
    ).rejects.toSatisfy((error: unknown) => isPadelClaimWindowExpiredError(error));
  });
});
