import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelTournamentTierApproval: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/tournaments/lifecycle/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelTournamentTierApproval.findUnique.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  POST = (await import("@/app/api/padel/tournaments/lifecycle/route")).POST;
});

describe("padel lifecycle tier governance", () => {
  it("falha com TIER_APPROVAL_REQUIRED quando tier OURO não está aprovado", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 10,
      status: "DRAFT",
      templateType: "PADEL",
      organizationId: 99,
      startsAt: new Date("2026-02-13T10:00:00.000Z"),
      padelTournamentConfig: {
        id: 101,
        lifecycleStatus: "DRAFT",
        publishedAt: null,
        lockedAt: null,
        liveAt: null,
        completedAt: null,
        cancelledAt: null,
      },
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValue({
      advancedSettings: { tournamentTier: "OURO" },
    });
    prisma.padelTournamentTierApproval.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/padel/tournaments/lifecycle", {
      method: "POST",
      body: JSON.stringify({ eventId: 10, nextStatus: "LOCKED" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("TIER_APPROVAL_REQUIRED");
    expect(body.tier).toBe("OURO");
  });
});
