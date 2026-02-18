import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runtime = vi.hoisted(() => ({
  authUser: { id: "target-user", email: "target@example.com" } as { id: string; email: string },
  membership: null as null | { memberId: string; groupId: number; role: string; rolePack: null },
  moduleAccessOk: false,
  currentMember: { memberId: "current-1" } as null | { memberId: string },
  invite: null as null | {
    id: string;
    organizationId: number;
    invitedByUserId: string;
    role: string;
    rolePack: string | null;
    token: string;
    targetIdentifier: string;
    targetUserId: string | null;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
  },
  findBarrier: null as null | (() => Promise<void>),
}));

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const setGroupMemberRoleForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const ensureUserIsOrganization = vi.hoisted(() => vi.fn());
const setSoleOwner = vi.hoisted(() => vi.fn());
const getEffectiveOrganizationMember = vi.hoisted(() => vi.fn());
const resolveRolePackForRole = vi.hoisted(() => vi.fn());
const canManageMembers = vi.hoisted(() => vi.fn());
const isOrgOwner = vi.hoisted(() => vi.fn());

const profileFindUnique = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());
const organizationMemberInviteFindFirst = vi.hoisted(() => vi.fn());
const organizationMemberInviteUpdateMany = vi.hoisted(() => vi.fn());
const organizationMemberInviteFindUnique = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationPermissions", () => ({ canManageMembers, isOrgOwner }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationRoles", () => ({ ensureUserIsOrganization, setSoleOwner }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg, setGroupMemberRoleForOrg }));
vi.mock("@/lib/organizationMembers", () => ({ getEffectiveOrganizationMember }));
vi.mock("@/lib/profileVisibility", () => ({ sanitizeProfileVisibility: (value: unknown) => value }));
vi.mock("@/lib/emailClient", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier: vi.fn() }));
vi.mock("@/lib/organizationRolePackPolicy", () => ({ resolveRolePackForRole }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    organization: { findUnique: organizationFindUnique },
    organizationMemberInvite: { findFirst: organizationMemberInviteFindFirst },
    $transaction: prismaTransaction,
  },
}));

import { PATCH } from "@/app/api/org-hub/organizations/members/invites/route";

function createPairBarrier(expected = 2) {
  let count = 0;
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    count += 1;
    if (count >= expected) release?.();
    await gate;
  };
}

function buildRequest(action: "ACCEPT" | "CANCEL") {
  return new NextRequest("http://localhost/api/org-hub/organizations/members/invites", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: 1, inviteId: "org-inv-1", action }),
  });
}

describe("org-hub invite transitions concurrent guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.authUser = { id: "target-user", email: "target@example.com" };
    runtime.membership = null;
    runtime.moduleAccessOk = false;
    runtime.currentMember = { memberId: "current-1" };
    runtime.findBarrier = null;
    runtime.invite = {
      id: "org-inv-1",
      organizationId: 1,
      invitedByUserId: "owner-1",
      role: "STAFF",
      rolePack: null,
      token: "tok-1",
      targetIdentifier: "target@example.com",
      targetUserId: null,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
    };

    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: runtime.authUser }, error: null })) },
    });
    resolveOrganizationIdStrict.mockReturnValue({ ok: true, organizationId: 1 });
    resolveGroupMemberForOrg.mockImplementation(async () => runtime.membership);
    ensureMemberModuleAccess.mockImplementation(async () => ({ ok: runtime.moduleAccessOk }));
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
    resolveRolePackForRole.mockReturnValue({ ok: true, rolePack: null });
    getEffectiveOrganizationMember.mockImplementation(async () => runtime.currentMember);
    canManageMembers.mockReturnValue(true);
    isOrgOwner.mockReturnValue(false);

    profileFindUnique.mockResolvedValue({ username: "target", roles: [] });
    organizationFindUnique.mockResolvedValue({
      officialEmail: "team@example.com",
      officialEmailVerifiedAt: new Date(),
    });

    organizationMemberInviteFindFirst.mockImplementation(async ({ where }: any) => {
      if (runtime.findBarrier) await runtime.findBarrier();
      const invite = runtime.invite;
      if (!invite) return null;
      if (where?.organizationId && where.organizationId !== invite.organizationId) return null;
      if (where?.id && where.id !== invite.id) return null;
      return { ...invite };
    });

    organizationMemberInviteUpdateMany.mockImplementation(async ({ where, data }: any) => {
      const invite = runtime.invite;
      if (!invite) return { count: 0 };
      if (where?.organizationId && where.organizationId !== invite.organizationId) return { count: 0 };
      if (typeof where?.id === "string" && where.id !== invite.id) return { count: 0 };
      if (where?.id && typeof where.id === "object" && where.id.not === invite.id) return { count: 0 };
      if (where?.acceptedAt === null && invite.acceptedAt !== null) return { count: 0 };
      if (where?.declinedAt === null && invite.declinedAt !== null) return { count: 0 };
      if (where?.cancelledAt === null && invite.cancelledAt !== null) return { count: 0 };
      runtime.invite = { ...invite, ...data };
      return { count: 1 };
    });

    organizationMemberInviteFindUnique.mockImplementation(async () => {
      const invite = runtime.invite;
      if (!invite) return null;
      return {
        ...invite,
        invitedBy: { id: invite.invitedByUserId, username: "owner", fullName: "Owner", avatarUrl: null },
        targetUser: invite.targetUserId
          ? { id: invite.targetUserId, username: "target", fullName: "Target", avatarUrl: null }
          : null,
        organization: { id: invite.organizationId, publicName: "Org 1" },
      };
    });

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        organizationMemberInvite: {
          updateMany: organizationMemberInviteUpdateMany,
          findUnique: organizationMemberInviteFindUnique,
        },
      }),
    );

    recordOrganizationAudit.mockResolvedValue(null);
    recordOutboxEvent.mockResolvedValue({ eventId: "evt-1" });
    appendEventLog.mockResolvedValue(null);
    ensureUserIsOrganization.mockResolvedValue(null);
    setGroupMemberRoleForOrg.mockResolvedValue(null);
    setSoleOwner.mockResolvedValue(null);
  });

  it("allows only one winner for simultaneous ACCEPT", async () => {
    runtime.findBarrier = createPairBarrier(2);

    const [resA, resB] = await Promise.all([PATCH(buildRequest("ACCEPT")), PATCH(buildRequest("ACCEPT"))]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
    expect(ensureUserIsOrganization).toHaveBeenCalledTimes(1);
    expect(recordOrganizationAudit).toHaveBeenCalledTimes(1);
  });

  it("allows only one winner for simultaneous CANCEL", async () => {
    runtime.authUser = { id: "admin-user", email: "admin@example.com" };
    runtime.membership = { memberId: "gm-1", groupId: 7, role: "ADMIN", rolePack: null };
    runtime.moduleAccessOk = true;
    runtime.invite = {
      ...runtime.invite!,
      targetIdentifier: "other@example.com",
      targetUserId: "other-user",
    };
    runtime.findBarrier = createPairBarrier(2);

    const [resA, resB] = await Promise.all([PATCH(buildRequest("CANCEL")), PATCH(buildRequest("CANCEL"))]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
    expect(recordOrganizationAudit).toHaveBeenCalledTimes(1);
  });

  it("allows only one winner for simultaneous ACCEPT and CANCEL", async () => {
    runtime.authUser = { id: "admin-user", email: "admin@example.com" };
    runtime.membership = { memberId: "gm-2", groupId: 7, role: "ADMIN", rolePack: null };
    runtime.moduleAccessOk = true;
    runtime.currentMember = { memberId: "current-2" };
    runtime.invite = {
      ...runtime.invite!,
      targetIdentifier: "admin@example.com",
      targetUserId: null,
    };
    runtime.findBarrier = createPairBarrier(2);

    const [acceptRes, cancelRes] = await Promise.all([PATCH(buildRequest("ACCEPT")), PATCH(buildRequest("CANCEL"))]);

    const statuses = [acceptRes.status, cancelRes.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
    expect(recordOrganizationAudit).toHaveBeenCalledTimes(1);
    expect(ensureUserIsOrganization.mock.calls.length).toBeLessThanOrEqual(1);
    expect(Boolean(runtime.invite?.acceptedAt)).not.toBe(Boolean(runtime.invite?.cancelledAt));
  });
});
