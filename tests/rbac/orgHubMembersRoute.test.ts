import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const getEffectiveOrganizationMember = vi.hoisted(() => vi.fn());
const listEffectiveOrganizationMembers = vi.hoisted(() => vi.fn());
const countEffectiveOrganizationMembersByRole = vi.hoisted(() => vi.fn());
const resolveRolePackForRole = vi.hoisted(() => vi.fn());
const canManageMembers = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const setSoleOwner = vi.hoisted(() => vi.fn());
const setGroupMemberRoleForOrg = vi.hoisted(() => vi.fn());
const revokeGroupMemberForOrg = vi.hoisted(() => vi.fn());

const organizationFindUnique = vi.hoisted(() => vi.fn());
const organizationGroupFindUnique = vi.hoisted(() => vi.fn());
const organizationGroupMemberFindFirst = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({
  resolveGroupMemberForOrg,
  setGroupMemberRoleForOrg,
  revokeGroupMemberForOrg,
}));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationMembers", () => ({
  getEffectiveOrganizationMember,
  listEffectiveOrganizationMembers,
  countEffectiveOrganizationMembersByRole,
}));
vi.mock("@/lib/organizationRolePackPolicy", () => ({ resolveRolePackForRole }));
vi.mock("@/lib/organizationPermissions", () => ({ canManageMembers }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/organizationRoles", () => ({ setSoleOwner }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    profile: { findMany: vi.fn() },
    organization: { findUnique: organizationFindUnique },
    organizationGroup: { findUnique: organizationGroupFindUnique },
    organizationGroupMember: { findFirst: organizationGroupMemberFindFirst },
    $transaction: prismaTransaction,
  },
}));

import { PATCH, DELETE } from "@/app/api/org-hub/organizations/members/route";

describe("org-hub organizations members route invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "actor-1", email: "owner@example.com" } },
          error: null,
        }),
      },
    });

    resolveOrganizationIdStrict.mockReturnValue({ ok: true, organizationId: 12 });
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-1",
      groupId: 99,
      role: "OWNER",
      rolePack: null,
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
    resolveRolePackForRole.mockReturnValue({ ok: true, rolePack: null });
    canManageMembers.mockReturnValue(true);

    organizationFindUnique.mockResolvedValue({
      officialEmail: "org@example.com",
      officialEmailVerifiedAt: new Date(),
    });
    organizationGroupFindUnique.mockResolvedValue({ ownerUserId: "group-owner-1" });
    getEffectiveOrganizationMember.mockResolvedValue({ role: "ADMIN", rolePack: null });
    organizationGroupMemberFindFirst.mockResolvedValue(null);

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({}),
    );
  });

  it("blocks setting OWNER for non group owner", async () => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/org-hub/organizations/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 12, userId: "user-2", role: "OWNER" }),
      }),
    );

    expect(res.status).toBe(409);
    expect(setSoleOwner).not.toHaveBeenCalled();
    expect(setGroupMemberRoleForOrg).not.toHaveBeenCalled();
  });

  it("allows setting OWNER when target is the group owner", async () => {
    getEffectiveOrganizationMember.mockResolvedValue({ role: "CO_OWNER", rolePack: null });
    organizationGroupMemberFindFirst.mockResolvedValue({ id: "gov-owner-1" });

    const res = await PATCH(
      new NextRequest("http://localhost/api/org-hub/organizations/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 12, userId: "group-owner-1", role: "OWNER" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(setSoleOwner).toHaveBeenCalled();
  });

  it("blocks deleting governance member via org endpoint", async () => {
    organizationGroupMemberFindFirst.mockResolvedValue({ id: "gov-1" });

    const res = await DELETE(
      new NextRequest("http://localhost/api/org-hub/organizations/members?userId=user-2", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(409);
    expect(revokeGroupMemberForOrg).not.toHaveBeenCalled();
  });
});
