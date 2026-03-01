import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  padelPlayerProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  padelGlobalRatingProfile: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
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
  prisma.padelGlobalRatingProfile.findUnique.mockReset();
  prisma.padelGlobalRatingProfile.findMany.mockReset();
  prisma.padelGlobalRatingProfile.count.mockReset();
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
  prisma.padelPlayerProfile.findMany
    .mockResolvedValueOnce([
      {
        id: 501,
        organizationId: 22,
        updatedAt: new Date("2026-02-17T09:00:00Z"),
      },
      {
        id: 502,
        organizationId: 23,
        updatedAt: new Date("2026-02-17T08:00:00Z"),
      },
    ])
    .mockResolvedValueOnce([
      { userId: "user-a" },
      { userId: "user-b" },
      { userId: "user-c" },
    ]);
  prisma.padelGlobalRatingProfile.findUnique.mockResolvedValue({
    id: 701,
    rating: 1605,
    rd: 58,
    sigma: 0.06,
    matchesPlayed: 24,
    leaderboardEligible: true,
    blockedNewMatches: false,
    lastMatchAt: new Date("2026-02-16T10:00:00Z"),
    lastActivityAt: new Date("2026-02-16T10:00:00Z"),
    lastRebuildAt: new Date("2026-02-16T10:05:00Z"),
  });
  prisma.padelGlobalRatingProfile.findMany.mockResolvedValue([
    { userId: "user-a", rating: 1605 },
    { userId: "user-b", rating: 1702 },
    { userId: "user-c", rating: 1605 },
  ]);
  prisma.padelGlobalRatingProfile.count.mockResolvedValue(3);
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
        blockedNewMatches: false,
        sourceGlobalProfileId: 701,
      }),
    );
  });
});
