import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PadelTeamMemberStatus } from "@prisma/client";

const runtime = vi.hoisted(() => ({
  authUser: { id: "viewer-1", email: "viewer@example.com" } as { id: string; email: string },
  membership: null as null | { memberId: string; groupId: number; role: string; rolePack: null },
  canAccess: false,
  invite: null as null | {
    id: string;
    teamId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date;
  },
  memberUpserts: 0,
  findBarrier: null as null | (() => Promise<void>),
}));

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const padelTeamFindUnique = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());
const padelTeamMemberInviteFindFirst = vi.hoisted(() => vi.fn());
const padelTeamMemberInviteUpdateMany = vi.hoisted(() => vi.fn());
const padelTeamMemberUpsert = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelTeam: { findUnique: padelTeamFindUnique },
    padelTeamMemberInvite: {
      findFirst: padelTeamMemberInviteFindFirst,
      updateMany: padelTeamMemberInviteUpdateMany,
    },
    padelTeamMember: { upsert: padelTeamMemberUpsert },
    profile: { findUnique: profileFindUnique },
    $transaction: prismaTransaction,
  },
}));

import { PATCH as teamInvitesPatch } from "@/app/api/padel/teams/[id]/invites/route";

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
  return new NextRequest("http://localhost/api/padel/teams/11/invites", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviteId: "team-inv-1", action }),
  });
}

describe("team invites concurrent transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.authUser = { id: "viewer-1", email: "viewer@example.com" };
    runtime.membership = null;
    runtime.canAccess = false;
    runtime.memberUpserts = 0;
    runtime.findBarrier = null;
    runtime.invite = {
      id: "team-inv-1",
      teamId: 11,
      targetIdentifier: "viewer@example.com",
      targetUserId: null,
      role: "PLAYER",
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: runtime.authUser } })) },
    });
    resolveOrganizationIdStrict.mockReturnValue({ ok: false, reason: "MISSING" });
    resolveGroupMemberForOrg.mockImplementation(async () => runtime.membership);
    ensureMemberModuleAccess.mockImplementation(async () => ({ ok: runtime.canAccess }));
    padelTeamFindUnique.mockResolvedValue({ id: 11, organizationId: 1, name: "Team 11" });
    profileFindUnique.mockResolvedValue({ username: "viewer", fullName: "Viewer" });

    padelTeamMemberInviteFindFirst.mockImplementation(async ({ where }: any) => {
      if (runtime.findBarrier) await runtime.findBarrier();
      const invite = runtime.invite;
      if (!invite) return null;
      if (where?.teamId && where.teamId !== invite.teamId) return null;
      if (where?.id && where.id !== invite.id) return null;
      return { ...invite };
    });

    padelTeamMemberInviteUpdateMany.mockImplementation(async ({ where, data }: any) => {
      const invite = runtime.invite;
      if (!invite) return { count: 0 };
      if (where?.teamId && where.teamId !== invite.teamId) return { count: 0 };
      if (typeof where?.id === "string" && where.id !== invite.id) return { count: 0 };
      if (where?.id && typeof where.id === "object" && where.id.not === invite.id) return { count: 0 };
      if (where?.acceptedAt === null && invite.acceptedAt !== null) return { count: 0 };
      if (where?.declinedAt === null && invite.declinedAt !== null) return { count: 0 };
      if (where?.cancelledAt === null && invite.cancelledAt !== null) return { count: 0 };
      runtime.invite = { ...invite, ...data };
      return { count: 1 };
    });

    padelTeamMemberUpsert.mockImplementation(async () => {
      runtime.memberUpserts += 1;
      return {
        id: 77,
        teamId: 11,
        userId: runtime.authUser.id,
        role: "PLAYER",
        status: PadelTeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
        user: { id: runtime.authUser.id, username: "viewer", fullName: "Viewer", avatarUrl: null },
      };
    });

    prismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        padelTeamMemberInvite: { updateMany: padelTeamMemberInviteUpdateMany },
        padelTeamMember: { upsert: padelTeamMemberUpsert },
      }),
    );
  });

  it("allows only one winner for simultaneous ACCEPT", async () => {
    runtime.findBarrier = createPairBarrier(2);

    const [resA, resB] = await Promise.all([
      teamInvitesPatch(buildRequest("ACCEPT"), { params: Promise.resolve({ id: "11" }) }),
      teamInvitesPatch(buildRequest("ACCEPT"), { params: Promise.resolve({ id: "11" }) }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.memberUpserts).toBe(1);
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

    const [resA, resB] = await Promise.all([
      teamInvitesPatch(buildRequest("CANCEL"), { params: Promise.resolve({ id: "11" }) }),
      teamInvitesPatch(buildRequest("CANCEL"), { params: Promise.resolve({ id: "11" }) }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.invite?.cancelledAt).toBeTruthy();
  });

  it("allows only one winner for simultaneous ACCEPT and CANCEL", async () => {
    runtime.membership = { memberId: "gm-2", groupId: 7, role: "ADMIN", rolePack: null };
    runtime.canAccess = true;
    runtime.findBarrier = createPairBarrier(2);

    const [acceptRes, cancelRes] = await Promise.all([
      teamInvitesPatch(buildRequest("ACCEPT"), { params: Promise.resolve({ id: "11" }) }),
      teamInvitesPatch(buildRequest("CANCEL"), { params: Promise.resolve({ id: "11" }) }),
    ]);

    const statuses = [acceptRes.status, cancelRes.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(runtime.memberUpserts).toBeLessThanOrEqual(1);
    expect(Boolean(runtime.invite?.acceptedAt)).not.toBe(Boolean(runtime.invite?.cancelledAt));
  });
});
