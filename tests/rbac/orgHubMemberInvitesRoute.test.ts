import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());

const organizationMemberInviteFindFirst = vi.hoisted(() => vi.fn());
const organizationMemberInviteUpdate = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationGroupAccess", () => ({
  resolveGroupMemberForOrg,
  setGroupMemberRoleForOrg: vi.fn(),
}));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/emailClient", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier: vi.fn() }));
vi.mock("@/lib/organizationRoles", () => ({ ensureUserIsOrganization: vi.fn(), setSoleOwner: vi.fn() }));
vi.mock("@/lib/organizationMembers", () => ({ getEffectiveOrganizationMember: vi.fn() }));
vi.mock("@/lib/profileVisibility", () => ({ sanitizeProfileVisibility: (value: unknown) => value }));
vi.mock("@/lib/organizationRolePackPolicy", () => ({ resolveRolePackForRole: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    organization: { findUnique: organizationFindUnique },
    organizationMemberInvite: {
      findFirst: organizationMemberInviteFindFirst,
      update: organizationMemberInviteUpdate,
    },
    $transaction: prismaTransaction,
  },
}));

import { PATCH } from "@/app/api/org-hub/organizations/members/invites/route";

function buildPendingInvite(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "inv-1",
    organizationId: 1,
    invitedByUserId: "owner-1",
    role: "STAFF",
    rolePack: null,
    token: "tok-1",
    targetIdentifier: "other@example.com",
    targetUserId: "other-user",
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    declinedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("org-hub members invites PATCH hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-user", email: "admin@example.com" } },
          error: null,
        }),
      },
    });

    resolveOrganizationIdStrict.mockReturnValue({ ok: true, organizationId: 1 });
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-1",
      groupId: 7,
      role: "ADMIN",
      rolePack: null,
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });

    profileFindUnique.mockResolvedValue({ username: "admin", roles: [] });
    organizationFindUnique.mockResolvedValue({
      officialEmail: "team@example.com",
      officialEmailVerifiedAt: new Date(),
    });

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        organizationMemberInvite: {
          update: organizationMemberInviteUpdate,
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
      }),
    );
  });

  it("blocks manager from declining invite targeted to another user", async () => {
    organizationMemberInviteFindFirst.mockResolvedValue(buildPendingInvite());

    const res = await PATCH(
      new NextRequest("http://localhost/api/org-hub/organizations/members/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 1, inviteId: "inv-1", action: "DECLINE" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("blocks admin from cancelling CO_OWNER invite", async () => {
    organizationMemberInviteFindFirst.mockResolvedValue(buildPendingInvite({ role: "CO_OWNER" }));

    const res = await PATCH(
      new NextRequest("http://localhost/api/org-hub/organizations/members/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 1, inviteId: "inv-1", action: "CANCEL" }),
      }),
    );

    expect(res.status).toBe(403);
  });
});
