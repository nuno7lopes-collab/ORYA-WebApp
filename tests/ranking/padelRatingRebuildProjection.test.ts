import { beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildPadelRatingsForEvent } from "@/domain/padel/ratingEngine";

type ProfileState = {
  id: number;
  organizationId: number;
  playerId: number;
  rating: number;
  rd: number;
  sigma: number;
  tau: number;
  matchesPlayed: number;
  lastMatchAt: Date | null;
  lastActivityAt: Date | null;
};

function buildTx() {
  let seq = 1;
  const profiles = new Map<number, ProfileState>();

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
      findMany: vi.fn(async () => [
        {
          id: 9001,
          score: { resultType: "NORMAL", winnerSide: "A" },
          scoreSets: [
            { teamA: 6, teamB: 4 },
            { teamA: 6, teamB: 3 },
          ],
          plannedEndAt: new Date("2026-02-16T11:00:00.000Z"),
          actualEndAt: new Date("2026-02-16T11:05:00.000Z"),
          updatedAt: new Date("2026-02-16T11:06:00.000Z"),
          participants: [
            { side: "A", participant: { playerProfileId: 101 } },
            { side: "A", participant: { playerProfileId: 102 } },
            { side: "B", participant: { playerProfileId: 201 } },
            { side: "B", participant: { playerProfileId: 202 } },
          ],
        },
      ]),
    },
    padelRatingProfile: {
      upsert: vi.fn(async ({ where, create }: any) => {
        const playerId = where.playerId as number;
        const existing = profiles.get(playerId);
        if (existing) return existing;
        const created: ProfileState = {
          id: seq++,
          organizationId: create.organizationId,
          playerId: create.playerId,
          rating: create.rating,
          rd: create.rd,
          sigma: create.sigma,
          tau: create.tau,
          matchesPlayed: create.matchesPlayed,
          lastMatchAt: null,
          lastActivityAt: null,
        };
        profiles.set(playerId, created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const profile = Array.from(profiles.values()).find((entry) => entry.id === where.id);
        if (!profile) throw new Error("PROFILE_NOT_FOUND");
        Object.assign(profile, data);
        return profile;
      }),
    },
    padelRatingEvent: {
      create: vi.fn(async ({ data }: any) => ({ id: Math.random(), ...data })),
    },
    padelRankingEntry: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
    },
  };

  return { tx, profiles };
}

describe("padel rating rebuild projections (B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconstrói rating e projeções por evento com contexto canónico", async () => {
    const { tx, profiles } = buildTx();

    const result = await rebuildPadelRatingsForEvent({
      tx,
      organizationId: 7,
      eventId: 44,
      actorUserId: "admin-1",
      tier: null,
    });

    expect(result.processedMatches).toBe(1);
    expect(result.processedPlayers).toBe(4);
    expect(result.rankingRows).toBe(4);
    expect(profiles.size).toBe(4);

    expect(tx.padelRatingEvent.create).toHaveBeenCalledTimes(4);
    expect(tx.padelRatingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 44,
          organizationId: 7,
          tier: "MAJOR",
          clubId: 501,
          city: "lisboa",
        }),
      }),
    );

    expect(tx.padelRankingEntry.deleteMany).toHaveBeenCalledWith({ where: { eventId: 44 } });
    expect(tx.padelRankingEntry.createMany).toHaveBeenCalledTimes(1);

    const payload = tx.padelRankingEntry.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(4);
    expect(payload[0]?.position).toBe(1);
    expect(payload.every((row) => row.eventId === 44)).toBe(true);
    expect(payload.every((row) => typeof row.level === "string")).toBe(true);
  });
});
