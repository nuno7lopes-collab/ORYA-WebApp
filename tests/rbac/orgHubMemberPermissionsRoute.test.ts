import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getEffectiveOrganizationMember = vi.hoisted(() => vi.fn());
const canManageMembers = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());

const organizationMemberPermissionUpsert = vi.hoisted(() => vi.fn());
const organizationMemberPermissionDeleteMany = vi.hoisted(() => vi.fn());
const organizationMemberPermissionFindMany = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());
const padelClubCourtFindFirst = vi.hoisted(() => vi.fn());
const reservationResourceFindFirst = vi.hoisted(() => vi.fn());
const reservationProfessionalFindFirst = vi.hoisted(() => vi.fn());
const chatCommunityFindFirst = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationMembers", () => ({ getEffectiveOrganizationMember }));
vi.mock("@/lib/organizationPermissions", () => ({ canManageMembers }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMemberPermission: {
      upsert: organizationMemberPermissionUpsert,
      deleteMany: organizationMemberPermissionDeleteMany,
      findMany: organizationMemberPermissionFindMany,
    },
    organization: {
      findUnique: organizationFindUnique,
    },
    padelClubCourt: {
      findFirst: padelClubCourtFindFirst,
    },
    reservationResource: {
      findFirst: reservationResourceFindFirst,
    },
    reservationProfessional: {
      findFirst: reservationProfessionalFindFirst,
    },
    chatCommunity: {
      findFirst: chatCommunityFindFirst,
    },
    $transaction: prismaTransaction,
  },
}));

import { PATCH } from "@/app/api/org-hub/organizations/members/permissions/route";

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/org-hub/organizations/members/permissions", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("org-hub members permissions PATCH scope hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn() },
    });
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "admin-user", email: "admin@example.com" } },
      error: null,
    });
    resolveOrganizationIdStrict.mockReturnValue({ ok: true, organizationId: 1 });
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-1",
      groupId: 7,
      role: "ADMIN",
      rolePack: null,
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    getEffectiveOrganizationMember.mockResolvedValue({
      memberId: "gm-target",
      role: "STAFF",
      rolePack: "FRONT_DESK",
    });
    canManageMembers.mockReturnValue(true);
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
    organizationFindUnique.mockResolvedValue({
      officialEmail: "team@example.com",
      officialEmailVerifiedAt: new Date(),
    });

    padelClubCourtFindFirst.mockResolvedValue({ id: 10 });
    reservationResourceFindFirst.mockResolvedValue({ id: 20 });
    reservationProfessionalFindFirst.mockResolvedValue({ id: 30 });
    chatCommunityFindFirst.mockResolvedValue({ conversationId: "community-1" });

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        organizationMemberPermission: {
          upsert: organizationMemberPermissionUpsert,
          deleteMany: organizationMemberPermissionDeleteMany,
        },
      }),
    );
    recordOrganizationAudit.mockResolvedValue(null);
    recordOutboxEvent.mockResolvedValue({ eventId: "evt-1" });
    appendEventLog.mockResolvedValue(null);
  });

  it("bloqueia scope de reservas fora do módulo reservas", async () => {
    const res = await PATCH(
      buildRequest({
        organizationId: 1,
        userId: "target-user",
        moduleKey: "MENSAGENS",
        accessLevel: "EDIT",
        scopeType: "COURT",
        scopeId: "10",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("SCOPE_TYPE_MODULE_MISMATCH");
    expect(organizationMemberPermissionUpsert).not.toHaveBeenCalled();
  });

  it("bloqueia scopeId sem scopeType", async () => {
    const res = await PATCH(
      buildRequest({
        organizationId: 1,
        userId: "target-user",
        moduleKey: "RESERVAS",
        accessLevel: "VIEW",
        scopeId: "10",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("INVALID_SCOPE_TYPE");
    expect(organizationMemberPermissionUpsert).not.toHaveBeenCalled();
  });

  it("bloqueia scope de campo quando o campo não pertence à organização", async () => {
    padelClubCourtFindFirst.mockResolvedValueOnce(null);

    const res = await PATCH(
      buildRequest({
        organizationId: 1,
        userId: "target-user",
        moduleKey: "RESERVAS",
        accessLevel: "EDIT",
        scopeType: "COURT",
        scopeId: "999",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("INVALID_SCOPE_ID");
    expect(organizationMemberPermissionUpsert).not.toHaveBeenCalled();
  });

  it("normaliza GLOBAL no scope de comunidades", async () => {
    const res = await PATCH(
      buildRequest({
        organizationId: 1,
        userId: "target-user",
        moduleKey: "MENSAGENS",
        accessLevel: "EDIT",
        scopeType: "CHAT_COMMUNITIES",
        scopeId: "global",
      }),
    );

    expect(res.status).toBe(200);
    expect(chatCommunityFindFirst).not.toHaveBeenCalled();
    expect(organizationMemberPermissionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId_moduleKey_scopeType_scopeId: {
            organizationId: 1,
            userId: "target-user",
            moduleKey: "MENSAGENS",
            scopeType: "CHAT_COMMUNITIES",
            scopeId: "GLOBAL",
          },
        },
      }),
    );
  });
});
