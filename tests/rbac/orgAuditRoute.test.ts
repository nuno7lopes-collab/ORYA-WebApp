import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const isOrgAdminOrAbove = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const organizationAuditFindMany = vi.hoisted(() => vi.fn());
const profileFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationPermissions", () => ({ isOrgAdminOrAbove }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationAuditLog: { findMany: organizationAuditFindMany },
    profile: { findMany: profileFindMany },
  },
}));

import { GET } from "@/app/api/org/[orgId]/audit/route";

describe("org audit route guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServer.mockResolvedValue({});
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@club.pt" } },
      error: null,
    });
    resolveOrganizationIdStrict.mockReturnValue({ ok: true, organizationId: 42 });
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-1",
      groupId: 7,
      role: "OWNER",
      rolePack: null,
    });
    isOrgAdminOrAbove.mockReturnValue(true);
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    organizationAuditFindMany.mockResolvedValue([]);
    profileFindMany.mockResolvedValue([]);
  });

  it("bloqueia membros sem papel de governança", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-2",
      groupId: 7,
      role: "STAFF",
      rolePack: "CLUB_MANAGER",
    });
    isOrgAdminOrAbove.mockReturnValue(false);

    const res = await GET(new NextRequest("http://localhost/api/org/42/audit"));
    expect(res.status).toBe(403);
    expect(organizationAuditFindMany).not.toHaveBeenCalled();
  });

  it("rejeita conflito de organizationId", async () => {
    resolveOrganizationIdStrict.mockReturnValue({
      ok: false,
      reason: "CONFLICT",
      values: [42, 99],
      candidates: [],
    });

    const res = await GET(
      new NextRequest("http://localhost/api/org/42/audit?organizationId=99"),
    );
    expect(res.status).toBe(400);
    expect(organizationAuditFindMany).not.toHaveBeenCalled();
  });

  it("faz fallback de limit inválido para 200", async () => {
    const res = await GET(new NextRequest("http://localhost/api/org/42/audit?limit=abc"));
    expect(res.status).toBe(200);
    expect(organizationAuditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("aplica clamp de limit para 500", async () => {
    const res = await GET(new NextRequest("http://localhost/api/org/42/audit?limit=9999"));
    expect(res.status).toBe(200);
    expect(organizationAuditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });
});
