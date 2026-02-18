import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runtime = vi.hoisted(() => ({
  authUser: { id: "viewer-1", email: "viewer@example.com" } as { id: string; email: string },
  membership: null as null | { memberId: string; groupId: number; role: string; rolePack: null },
  canAccess: false,
  invite: null as null | {
    id: string;
    padelClubId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    inheritToEvents: boolean;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date;
  },
  staff: null as null | {
    id: number;
    padelClubId: number;
    userId: string;
    role: string;
    inheritToEvents: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    user: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      users: { email: string | null };
    };
  },
  staffCreates: 0,
  findBarrier: null as null | (() => Promise<void>),
}));

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const readNumericParam = vi.hoisted(() => vi.fn());
const padelClubFindFirst = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());
const padelClubStaffInviteFindFirst = vi.hoisted(() => vi.fn());
const padelClubStaffInviteUpdateMany = vi.hoisted(() => vi.fn());
const padelClubStaffFindFirst = vi.hoisted(() => vi.fn());
const padelClubStaffCreate = vi.hoisted(() => vi.fn());
const padelClubStaffUpdate = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/routeParams", () => ({ readNumericParam }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelClub: { findFirst: padelClubFindFirst },
    padelClubStaffInvite: {
      findFirst: padelClubStaffInviteFindFirst,
      updateMany: padelClubStaffInviteUpdateMany,
    },
    padelClubStaff: {
      findFirst: padelClubStaffFindFirst,
      create: padelClubStaffCreate,
      update: padelClubStaffUpdate,
    },
    profile: { findUnique: profileFindUnique },
    $transaction: prismaTransaction,
  },
}));

import { PATCH as clubStaffInvitesPatch } from "@/app/api/padel/clubs/[id]/staff/invites/route";

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
  return new NextRequest("http://localhost/api/padel/clubs/22/staff/invites", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviteId: "club-inv-1", action }),
  });
}

describe("club staff invites concurrent transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.authUser = { id: "viewer-1", email: "viewer@example.com" };
    runtime.membership = null;
    runtime.canAccess = false;
    runtime.staffCreates = 0;
    runtime.findBarrier = null;
    runtime.invite = {
      id: "club-inv-1",
      padelClubId: 22,
      targetIdentifier: "viewer@example.com",
      targetUserId: null,
      role: "MANAGER",
      inheritToEvents: true,
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    runtime.staff = null;

    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: runtime.authUser } })) },
    });
    resolveOrganizationIdStrict.mockReturnValue({ ok: false, reason: "MISSING" });
    resolveGroupMemberForOrg.mockImplementation(async () => runtime.membership);
    ensureMemberModuleAccess.mockImplementation(async () => ({ ok: runtime.canAccess }));
    readNumericParam.mockReturnValue(22);
    padelClubFindFirst.mockResolvedValue({ id: 22, organizationId: 1, name: "Club 22" });
    profileFindUnique.mockResolvedValue({ username: "viewer", fullName: "Viewer" });

    padelClubStaffInviteFindFirst.mockImplementation(async ({ where }: any) => {
      if (runtime.findBarrier) await runtime.findBarrier();
      const invite = runtime.invite;
      if (!invite) return null;
      if (where?.padelClubId && where.padelClubId !== invite.padelClubId) return null;
      if (where?.id && where.id !== invite.id) return null;
      return { ...invite };
    });

    padelClubStaffInviteUpdateMany.mockImplementation(async ({ where, data }: any) => {
      const invite = runtime.invite;
      if (!invite) return { count: 0 };
      if (where?.padelClubId && where.padelClubId !== invite.padelClubId) return { count: 0 };
      if (typeof where?.id === "string" && where.id !== invite.id) return { count: 0 };
      if (where?.id && typeof where.id === "object" && where.id.not === invite.id) return { count: 0 };
      if (where?.acceptedAt === null && invite.acceptedAt !== null) return { count: 0 };
      if (where?.declinedAt === null && invite.declinedAt !== null) return { count: 0 };
      if (where?.cancelledAt === null && invite.cancelledAt !== null) return { count: 0 };
      runtime.invite = { ...invite, ...data };
      return { count: 1 };
    });

    padelClubStaffFindFirst.mockImplementation(async ({ where }: any) => {
      const staff = runtime.staff;
      if (!staff) return null;
      if (where?.padelClubId && where.padelClubId !== staff.padelClubId) return null;
      if (where?.userId && where.userId !== staff.userId) return null;
      if (where?.deletedAt === null && staff.deletedAt !== null) return null;
      return { ...staff };
    });

    padelClubStaffCreate.mockImplementation(async ({ data }: any) => {
      runtime.staffCreates += 1;
      const now = new Date();
      runtime.staff = {
        id: 901,
        padelClubId: data.padelClubId,
        userId: data.userId,
        role: data.role,
        inheritToEvents: data.inheritToEvents,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        user: {
          id: data.userId,
          username: "viewer",
          fullName: "Viewer",
          avatarUrl: null,
          users: { email: runtime.authUser.email },
        },
      };
      return { ...runtime.staff };
    });

    padelClubStaffUpdate.mockImplementation(async ({ data }: any) => {
      if (!runtime.staff) return null;
      runtime.staff = { ...runtime.staff, ...data, updatedAt: new Date() };
      return { ...runtime.staff };
    });

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        padelClubStaffInvite: { updateMany: padelClubStaffInviteUpdateMany },
        padelClubStaff: {
          findFirst: padelClubStaffFindFirst,
          create: padelClubStaffCreate,
          update: padelClubStaffUpdate,
        },
      }),
    );
  });

  it("allows only one winner for simultaneous ACCEPT", async () => {
    runtime.findBarrier = createPairBarrier(2);

    const [resA, resB] = await Promise.all([clubStaffInvitesPatch(buildRequest("ACCEPT")), clubStaffInvitesPatch(buildRequest("ACCEPT"))]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.staffCreates).toBe(1);
  });

  it("allows only one winner for simultaneous CANCEL", async () => {
    runtime.membership = { memberId: "gm-1", groupId: 7, role: "ADMIN", rolePack: null };
    runtime.canAccess = true;
    runtime.invite = {
      ...runtime.invite!,
      targetIdentifier: "other@example.com",
      targetUserId: "target-1",
    };
    runtime.findBarrier = createPairBarrier(2);

    const [resA, resB] = await Promise.all([clubStaffInvitesPatch(buildRequest("CANCEL")), clubStaffInvitesPatch(buildRequest("CANCEL"))]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.invite?.cancelledAt).toBeTruthy();
  });

  it("allows only one winner for simultaneous ACCEPT and CANCEL", async () => {
    runtime.membership = { memberId: "gm-2", groupId: 7, role: "ADMIN", rolePack: null };
    runtime.canAccess = true;
    runtime.findBarrier = createPairBarrier(2);

    const [acceptRes, cancelRes] = await Promise.all([
      clubStaffInvitesPatch(buildRequest("ACCEPT")),
      clubStaffInvitesPatch(buildRequest("CANCEL")),
    ]);

    const statuses = [acceptRes.status, cancelRes.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.staffCreates).toBeLessThanOrEqual(1);
    expect(Boolean(runtime.invite?.acceptedAt)).not.toBe(Boolean(runtime.invite?.cancelledAt));
  });
});
