import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const syncTournamentOperationalRolesFromClubStaff = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelTournamentTierApproval: { findUnique: vi.fn() },
  padelEventCategoryLink: { findMany: vi.fn() },
  padelTournamentRoleAssignment: { count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/padel/tournamentStaffRoleSync", () => ({ syncTournamentOperationalRolesFromClubStaff }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/tournaments/lifecycle/route").POST;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  syncTournamentOperationalRolesFromClubStaff.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelTournamentTierApproval.findUnique.mockReset();
  prisma.padelEventCategoryLink.findMany.mockReset();
  prisma.padelTournamentRoleAssignment.count.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u-1" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  syncTournamentOperationalRolesFromClubStaff.mockResolvedValue({
    attempted: 2,
    created: 1,
    mappedUsers: 1,
  });
  prisma.event.findUnique.mockResolvedValue({
    id: 10,
    status: "DRAFT",
    templateType: "PADEL",
    organizationId: 99,
    startsAt: new Date("2026-03-01T10:00:00.000Z"),
    padelTournamentConfig: {
      id: 101,
      lifecycleStatus: "DRAFT",
      publishedAt: null,
      lockedAt: null,
      completedAt: null,
      cancelledAt: null,
    },
  });
  prisma.padelTournamentConfig.findUnique.mockResolvedValueOnce({
    advancedSettings: {},
  });
  prisma.padelTournamentConfig.findUnique.mockResolvedValueOnce({
    id: 101,
    format: "TODOS_CONTRA_TODOS",
    padelClubId: 7,
    partnerClubIds: [],
    numberOfCourts: 2,
    advancedSettings: { staffIds: [11, 22] },
    padelV2Enabled: true,
  });
  prisma.padelEventCategoryLink.findMany.mockResolvedValue([]);
  prisma.padelTournamentRoleAssignment.count.mockResolvedValue(1);
  prisma.$transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));

  POST = (await import("@/app/api/padel/tournaments/lifecycle/route")).POST;
});

describe("padel lifecycle publish staff sync", () => {
  it("syncs selected club staff before publish readiness checks", async () => {
    const req = new NextRequest("http://localhost/api/padel/tournaments/lifecycle", {
      method: "POST",
      body: JSON.stringify({ eventId: 10, nextStatus: "PUBLISHED" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("TOURNAMENT_NOT_READY");
    expect(syncTournamentOperationalRolesFromClubStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 99,
        eventId: 10,
        staffIds: [11, 22],
        padelClubId: 7,
      }),
    );
  });

  it("does not sync when staffIds are empty", async () => {
    prisma.padelTournamentConfig.findUnique.mockReset();
    prisma.padelTournamentConfig.findUnique.mockResolvedValueOnce({
      advancedSettings: {},
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValueOnce({
      id: 101,
      format: "TODOS_CONTRA_TODOS",
      padelClubId: 7,
      partnerClubIds: [],
      numberOfCourts: 2,
      advancedSettings: { staffIds: [] },
      padelV2Enabled: true,
    });

    const req = new NextRequest("http://localhost/api/padel/tournaments/lifecycle", {
      method: "POST",
      body: JSON.stringify({ eventId: 10, nextStatus: "PUBLISHED" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("TOURNAMENT_NOT_READY");
    expect(syncTournamentOperationalRolesFromClubStaff).not.toHaveBeenCalled();
  });
});
