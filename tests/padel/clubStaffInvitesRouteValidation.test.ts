import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveUserIdentifier = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelClub: { findFirst: vi.fn() },
  profile: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/clubs/[id]/staff/invites/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "u-admin", email: "admin@example.com" } } });
  resolveOrganizationIdStrict.mockReturnValue({ ok: false, reason: "MISSING" });
  resolveGroupMemberForOrg.mockResolvedValue({ role: "ADMIN", rolePack: null });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.padelClub.findFirst.mockResolvedValue({ id: 22, organizationId: 101, name: "Clube Teste" });
  prisma.profile.findUnique.mockResolvedValue({ username: "admin" });

  POST = (await import("@/app/api/padel/clubs/[id]/staff/invites/route")).POST;
});

describe("POST /api/padel/clubs/[id]/staff/invites validação", () => {
  it("rejeita inheritToEvents ausente sem default permissivo", async () => {
    const req = new NextRequest("http://localhost/api/padel/clubs/22/staff/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier: "target@example.com",
        role: "STAFF",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_INHERIT_TO_EVENTS");
    expect(resolveUserIdentifier).not.toHaveBeenCalled();
  });
});
