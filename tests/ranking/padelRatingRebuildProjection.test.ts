import { beforeEach, describe, expect, it, vi } from "vitest";

const rebuildPadelGlobalRatings = vi.hoisted(() => vi.fn());
const syncPadelRankingEntriesForEventFromGlobal = vi.hoisted(() => vi.fn());

vi.mock("@/domain/padel/globalRating", () => ({
  rebuildPadelGlobalRatings,
  syncPadelRankingEntriesForEventFromGlobal,
}));

import { rebuildPadelRatingsForEvent } from "@/domain/padel/ratingEngine";

describe("padel rating rebuild projections (B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconstrói rating global e sincroniza entradas do evento de forma determinística", async () => {
    const tx: any = {
      event: {
        findUnique: vi.fn(async () => ({
          id: 44,
          organizationId: 7,
          addressRef: { canonical: { city: "Lisboa" } },
          padelTournamentConfig: {
            padelClubId: 501,
            advancedSettings: { tournamentTier: "MAJOR" },
          },
        })),
      },
      eventMatchSlot: {
        count: vi.fn(async () => 3),
      },
    };

    rebuildPadelGlobalRatings.mockResolvedValue({
      processedMatches: 12,
      processedPlayers: 32,
      touchedUsers: ["a", "b"],
    });
    syncPadelRankingEntriesForEventFromGlobal.mockResolvedValue(8);

    const result = await rebuildPadelRatingsForEvent({
      tx,
      organizationId: 7,
      eventId: 44,
      actorUserId: "admin-1",
      tier: null,
    });

    expect(rebuildPadelGlobalRatings).toHaveBeenCalledWith({ tx });
    expect(syncPadelRankingEntriesForEventFromGlobal).toHaveBeenCalledWith({
      tx,
      eventId: 44,
      organizationId: 7,
    });
    expect(tx.eventMatchSlot.count).toHaveBeenCalledWith({
      where: { eventId: 44, status: { in: ["OFFICIAL", "WALKOVER", "RETIRED"] } },
    });
    expect(result).toEqual({
      processedMatches: 3,
      processedPlayers: 8,
      rankingRows: 8,
    });
  });

  it("devolve resultado vazio quando o evento não pertence à organização pedida", async () => {
    const tx: any = {
      event: { findUnique: vi.fn(async () => ({ id: 44, organizationId: 99, addressRef: null, padelTournamentConfig: null })) },
      eventMatchSlot: { count: vi.fn() },
    };

    const result = await rebuildPadelRatingsForEvent({
      tx,
      organizationId: 7,
      eventId: 44,
    });

    expect(rebuildPadelGlobalRatings).not.toHaveBeenCalled();
    expect(syncPadelRankingEntriesForEventFromGlobal).not.toHaveBeenCalled();
    expect(result).toEqual({
      processedMatches: 0,
      processedPlayers: 0,
      rankingRows: 0,
    });
  });
});
