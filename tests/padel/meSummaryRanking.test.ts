import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  padelPlayerProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  padelRatingProfile: { count: vi.fn() },
  padelPairing: { findMany: vi.fn() },
  padelWaitlistEntry: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/me/summary/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.padelPlayerProfile.findFirst.mockReset();
  prisma.padelPlayerProfile.findMany.mockReset();
  prisma.padelRatingProfile.count.mockReset();
  prisma.padelPairing.findMany.mockReset();
  prisma.padelWaitlistEntry.findMany.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-a", email: "a@orya.pt" } } })) },
  });

  prisma.profile.findUnique.mockResolvedValue({
    id: "user-a",
    fullName: "Jogador A",
    username: "jogador-a",
    avatarUrl: null,
    gender: null,
    padelLevel: "M3",
    padelPreferredSide: "DIREITA",
    padelClubName: "ORYA Club",
  });
  prisma.padelPlayerProfile.findFirst.mockResolvedValue(null);
  prisma.padelPlayerProfile.findMany.mockResolvedValue([
    {
      id: 501,
      organizationId: 22,
      updatedAt: new Date("2026-02-17T09:00:00Z"),
      ratingProfile: {
        rating: 1605,
        matchesPlayed: 24,
        leaderboardEligible: true,
        blockedNewMatches: false,
        lastMatchAt: new Date("2026-02-16T10:00:00Z"),
        lastRebuildAt: new Date("2026-02-16T10:05:00Z"),
      },
    },
    {
      id: 502,
      organizationId: 23,
      updatedAt: new Date("2026-02-17T08:00:00Z"),
      ratingProfile: {
        rating: 1690,
        matchesPlayed: 12,
        leaderboardEligible: true,
        blockedNewMatches: false,
        lastMatchAt: new Date("2026-02-15T10:00:00Z"),
        lastRebuildAt: new Date("2026-02-15T10:05:00Z"),
      },
    },
  ]);
  prisma.padelRatingProfile.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
  prisma.padelPairing.findMany.mockResolvedValue([]);
  prisma.padelWaitlistEntry.findMany.mockResolvedValue([]);

  GET = (await import("@/app/api/padel/me/summary/route")).GET;
});

describe("GET /api/padel/me/summary ranking payload", () => {
  it("devolve ranking com posição global e posição na organização", async () => {
    const req = new NextRequest("http://localhost/api/padel/me/summary", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body;

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.ranking).toEqual(
      expect.objectContaining({
        rating: 1605,
        orgPosition: 2,
        globalPosition: 4,
        matchesPlayed: 24,
        leaderboardEligible: true,
        sourcePlayerProfileId: 501,
      }),
    );
  });
});
