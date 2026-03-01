import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensurePadelEventRankingSnapshot = vi.hoisted(() => vi.fn(async () => 1));
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));
const enforceMobileVersionGate = vi.hoisted(() => vi.fn(() => null));

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelEventRankingSnapshot: { findMany: vi.fn() },
  padelTournamentParticipant: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  padelGlobalRatingEvent: { findMany: vi.fn() },
  padelGlobalRatingProfile: { findMany: vi.fn() },
}));

vi.mock("@/domain/padel/globalRating", () => ({
  ensurePadelEventRankingSnapshot,
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));
vi.mock("@/lib/http/mobileVersionGate", () => ({
  enforceMobileVersionGate: (...args: unknown[]) => enforceMobileVersionGate(...args),
}));
vi.mock("@/lib/events/accessPolicy", () => ({
  resolveEventAccessMode: vi.fn(() => "PUBLIC"),
  isPublicAccessMode: vi.fn(() => true),
}));
vi.mock("@/domain/padelCompetitionState", () => ({
  resolvePadelCompetitionState: vi.fn(() => "PUBLIC"),
}));
vi.mock("@/domain/events/publicStatus", () => ({
  isPublicEventStatus: vi.fn(() => true),
}));

describe("GET /api/padel/rankings snapshotMode", () => {
  beforeEach(() => {
    vi.resetModules();
    ensurePadelEventRankingSnapshot.mockClear();
    enforcePublicRateLimit.mockClear();
    enforceMobileVersionGate.mockClear();
    prisma.event.findUnique.mockReset();
    prisma.padelEventRankingSnapshot.findMany.mockReset();
    prisma.padelTournamentParticipant.findMany.mockReset();
    prisma.eventMatchSlot.findMany.mockReset();
    prisma.padelGlobalRatingEvent.findMany.mockReset();
    prisma.padelGlobalRatingProfile.findMany.mockReset();

    prisma.event.findUnique.mockResolvedValue({
      templateType: "PADEL",
      status: "PUBLISHED",
      organizationId: 77,
      padelTournamentConfig: { advancedSettings: { competitionState: "PUBLIC" }, lifecycleStatus: "PUBLIC" },
      accessPolicies: [{ mode: "PUBLIC" }],
    });
  });

  it("usa snapshot START por defeito quando existe eventId e ignora periodDays implícito", async () => {
    prisma.padelEventRankingSnapshot.findMany.mockResolvedValue([
      {
        points: 1500,
        rating: 1500,
        playerId: 9,
        userId: "user-9",
        player: { id: 9, fullName: "Jogador 9", level: "3.4" },
        user: { fullName: "Jogador 9" },
      },
    ]);

    const { GET } = await import("@/app/api/padel/rankings/route");
    const req = new NextRequest("http://localhost/api/padel/rankings?eventId=55&periodDays=90");
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body?.result && typeof body.result === "object" && "ok" in body.result
          ? body.result
          : body;

    expect(res.status).toBe(200);
    expect(payload.meta.snapshotMode).toBe("START");
    expect(ensurePadelEventRankingSnapshot).toHaveBeenCalledWith({
      tx: prisma,
      eventId: 55,
      snapshotMode: "START",
    });
    expect(prisma.padelEventRankingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 55, snapshotMode: "START" },
      }),
    );
    expect(payload.items[0]).toMatchObject({
      position: 1,
      points: 1500,
      rating: 1500,
      player: { id: 9, fullName: "Jogador 9" },
    });
  });

  it("em CURRENT aplica periodDays explicitamente e não congela snapshot START", async () => {
    prisma.padelTournamentParticipant.findMany.mockResolvedValue([
      {
        playerProfileId: 31,
        playerProfile: { id: 31, userId: "user-31", fullName: "Jogador 31", displayName: null, level: "4.0" },
      },
    ]);
    prisma.padelGlobalRatingEvent.findMany.mockResolvedValue([{ userId: "user-31" }]);
    prisma.padelGlobalRatingProfile.findMany.mockResolvedValue([
      {
        userId: "user-31",
        rating: 1678,
        rd: 54,
        sigma: 0.06,
        lastActivityAt: new Date("2026-02-10T10:00:00Z"),
      },
    ]);

    const { GET } = await import("@/app/api/padel/rankings/route");
    const req = new NextRequest("http://localhost/api/padel/rankings?eventId=55&snapshotMode=CURRENT&periodDays=90");
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body?.result && typeof body.result === "object" && "ok" in body.result
          ? body.result
          : body;

    expect(res.status).toBe(200);
    expect(payload.meta.snapshotMode).toBe("CURRENT");
    expect(ensurePadelEventRankingSnapshot).not.toHaveBeenCalled();
    const filterArgs = prisma.padelGlobalRatingEvent.findMany.mock.calls[0]?.[0];
    expect(filterArgs?.where?.eventId).toBe(55);
    expect(filterArgs?.where?.occurredAt?.gte).toBeInstanceOf(Date);
    expect(payload.items[0]).toMatchObject({
      position: 1,
      points: 1678,
      rating: 1678,
      player: { id: 31, fullName: "Jogador 31" },
    });
  });

  it("faz fallback seguro quando schema de rating global ainda não existe", async () => {
    const err = Object.assign(new Error("The table `app_v3.padel_global_rating_profiles` does not exist"), {
      code: "P2021",
    });
    prisma.padelGlobalRatingProfile.findMany.mockRejectedValueOnce(err);

    const { GET } = await import("@/app/api/padel/rankings/route");
    const req = new NextRequest("http://localhost/api/padel/rankings?scope=global&periodDays=90&limit=80");
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body?.result && typeof body.result === "object" && "ok" in body.result
          ? body.result
          : body;

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.items).toEqual([]);
    expect(payload.meta).toMatchObject({
      bootstrap: true,
      reason: "RANKING_SCHEMA_MISSING",
    });
  });
});
