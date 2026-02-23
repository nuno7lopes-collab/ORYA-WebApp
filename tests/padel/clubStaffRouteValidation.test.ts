import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelClub: { findFirst: vi.fn() },
  profile: { findFirst: vi.fn() },
  users: { findFirst: vi.fn() },
  padelClubStaff: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/clubs/[id]/staff/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "u-admin" } } });
  resolveOrganizationIdStrict.mockReturnValue({ ok: false, reason: "MISSING" });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.padelClub.findFirst.mockResolvedValue({ id: 22, organizationId: 101 });

  POST = (await import("@/app/api/padel/clubs/[id]/staff/route")).POST;
});

describe("POST /api/padel/clubs/[id]/staff validação", () => {
  it("rejeita inheritToEvents ausente sem default permissivo", async () => {
    const req = new NextRequest("http://localhost/api/padel/clubs/22/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "u-target",
        role: "STAFF",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_INHERIT_TO_EVENTS");
    expect(prisma.padelClubStaff.findFirst).not.toHaveBeenCalled();
    expect(prisma.padelClubStaff.create).not.toHaveBeenCalled();
  });
});
