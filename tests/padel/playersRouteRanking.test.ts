import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelPlayerProfile: { findMany: vi.fn() },
  profile: { findMany: vi.fn() },
  crmContact: { findMany: vi.fn() },
  padelGlobalRatingProfile: { findMany: vi.fn() },
  padelPairingSlot: { findMany: vi.fn(), groupBy: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/players/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.padelPlayerProfile.findMany.mockReset();
  prisma.profile.findMany.mockReset();
  prisma.crmContact.findMany.mockReset();
  prisma.padelGlobalRatingProfile.findMany.mockReset();
  prisma.padelPairingSlot.findMany.mockReset();
  prisma.padelPairingSlot.groupBy.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();
  prisma.profile.findMany.mockResolvedValue([]);
  prisma.crmContact.findMany.mockResolvedValue([]);

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 22 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  GET = (await import("@/app/api/padel/players/route")).GET;
});

describe("GET /api/padel/players ranking payload", () => {
  it("devolve bloco ranking completo por jogador", async () => {
    prisma.padelPlayerProfile.findMany.mockResolvedValue([
      {
        id: 101,
        organizationId: 22,
        userId: "user-101",
        crmContactId: null,
        fullName: "Jogador A",
        email: null,
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
        notes: null,
        displayName: "Jogador A",
        birthDate: null,
        isActive: true,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        updatedAt: new Date("2026-01-02T10:00:00Z"),
      },
    ]);

    prisma.padelGlobalRatingProfile.findMany.mockResolvedValue([
      {
        id: 901,
        userId: "user-101",
        rating: 1512,
        matchesPlayed: 16,
        leaderboardEligible: true,
        blockedNewMatches: false,
        lastMatchAt: new Date("2026-02-10T10:00:00Z"),
        lastRebuildAt: new Date("2026-02-11T10:00:00Z"),
      },
    ]);

    prisma.padelPairingSlot.findMany.mockResolvedValue([]);
    prisma.padelPairingSlot.groupBy.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/padel/players?organizationId=22", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body;

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.items[0].ranking).toEqual(
      expect.objectContaining({
        rating: 1512,
        orgPosition: 1,
        matchesPlayed: 16,
        leaderboardEligible: true,
        blockedNewMatches: false,
      }),
    );
  });

  it("faz fallback seguro quando schema de rating global ainda não existe", async () => {
    prisma.padelPlayerProfile.findMany.mockResolvedValue([
      {
        id: 202,
        organizationId: 22,
        userId: "user-202",
        crmContactId: null,
        fullName: "Jogador B",
        email: null,
        phone: null,
        gender: null,
        level: null,
        preferredSide: null,
        clubName: null,
        notes: null,
        displayName: "Jogador B",
        birthDate: null,
        isActive: true,
        createdAt: new Date("2026-01-03T10:00:00Z"),
        updatedAt: new Date("2026-01-04T10:00:00Z"),
      },
    ]);

    const err = Object.assign(new Error("The table `app_v3.padel_global_rating_profiles` does not exist"), {
      code: "P2021",
      meta: { table: "app_v3.padel_global_rating_profiles" },
    });
    prisma.padelGlobalRatingProfile.findMany.mockRejectedValueOnce(err);

    prisma.padelPairingSlot.findMany.mockResolvedValue([]);
    prisma.padelPairingSlot.groupBy.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/padel/players?organizationId=22", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    const payload =
      body?.data && typeof body.data === "object" && "ok" in body.data
        ? body.data
        : body;

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.items[0].ranking).toEqual(
      expect.objectContaining({
        rating: null,
        orgPosition: null,
        matchesPlayed: 0,
        leaderboardEligible: false,
        blockedNewMatches: false,
      }),
    );
  });
});
