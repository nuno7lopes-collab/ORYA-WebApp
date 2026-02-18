import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const resolveOrganizationIdStrict = vi.hoisted(() => vi.fn());
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const readNumericParam = vi.hoisted(() => vi.fn());

const padelTeamFindUnique = vi.hoisted(() => vi.fn());
const padelTeamMemberInviteFindFirst = vi.hoisted(() => vi.fn());
const padelTeamMemberInviteFindMany = vi.hoisted(() => vi.fn());
const padelTeamMemberInviteUpdate = vi.hoisted(() => vi.fn());
const padelClubFindFirst = vi.hoisted(() => vi.fn());
const padelClubStaffInviteFindFirst = vi.hoisted(() => vi.fn());
const padelClubStaffInviteFindMany = vi.hoisted(() => vi.fn());
const padelClubStaffInviteUpdate = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdStrict }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/routeParams", () => ({ readNumericParam }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/userResolver", () => ({ resolveUserIdentifier: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelTeam: { findUnique: padelTeamFindUnique },
    padelTeamMemberInvite: {
      findFirst: padelTeamMemberInviteFindFirst,
      findMany: padelTeamMemberInviteFindMany,
      update: padelTeamMemberInviteUpdate,
    },
    padelClub: { findFirst: padelClubFindFirst },
    padelClubStaffInvite: {
      findFirst: padelClubStaffInviteFindFirst,
      findMany: padelClubStaffInviteFindMany,
      update: padelClubStaffInviteUpdate,
    },
    profile: { findUnique: profileFindUnique },
  },
}));

import { GET as teamInvitesGet } from "@/app/api/padel/teams/[id]/invites/route";
import { PATCH as teamInvitesPatch } from "@/app/api/padel/teams/[id]/invites/route";
import { GET as clubStaffInvitesGet } from "@/app/api/padel/clubs/[id]/staff/invites/route";
import { PATCH as clubStaffInvitesPatch } from "@/app/api/padel/clubs/[id]/staff/invites/route";

describe("workforce invite visibility hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "viewer-1", email: "viewer@example.com" } },
        }),
      },
    });

    resolveOrganizationIdStrict.mockReturnValue({ ok: false, reason: "MISSING" });
    resolveGroupMemberForOrg.mockResolvedValue(null);
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });
    profileFindUnique.mockResolvedValue({ username: "viewer", fullName: "Viewer" });

    padelTeamFindUnique.mockResolvedValue({ id: 11, organizationId: 1, name: "Team 11" });
    padelTeamMemberInviteFindFirst.mockResolvedValue(null);

    readNumericParam.mockReturnValue(22);
    padelClubFindFirst.mockResolvedValue({ id: 22, organizationId: 1, name: "Club 22" });
    padelClubStaffInviteFindFirst.mockResolvedValue(null);
  });

  it("blocks unprivileged team invite listing when viewer has no matching invite", async () => {
    const res = await teamInvitesGet(
      new NextRequest("http://localhost/api/padel/teams/11/invites", { method: "GET" }),
      { params: Promise.resolve({ id: "11" }) },
    );

    expect(res.status).toBe(403);
    expect(padelTeamMemberInviteFindMany).not.toHaveBeenCalled();
  });

  it("blocks unprivileged club invite listing when viewer has no matching invite", async () => {
    const res = await clubStaffInvitesGet(
      new NextRequest("http://localhost/api/padel/clubs/22/staff/invites", { method: "GET" }),
    );

    expect(res.status).toBe(403);
    expect(padelClubStaffInviteFindMany).not.toHaveBeenCalled();
  });

  it("rejects team invite cancel when invite is not pending", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-1",
      groupId: 1,
      role: "ADMIN",
      rolePack: null,
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    padelTeamMemberInviteFindFirst.mockResolvedValue({
      id: "team-inv-1",
      targetIdentifier: "other@example.com",
      targetUserId: "other-user",
      acceptedAt: new Date(),
      declinedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await teamInvitesPatch(
      new NextRequest("http://localhost/api/padel/teams/11/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: "team-inv-1", action: "CANCEL" }),
      }),
      { params: Promise.resolve({ id: "11" }) },
    );

    expect(res.status).toBe(409);
    expect(padelTeamMemberInviteUpdate).not.toHaveBeenCalled();
  });

  it("rejects club invite cancel when invite is not pending", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      memberId: "gm-2",
      groupId: 1,
      role: "ADMIN",
      rolePack: null,
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    padelClubStaffInviteFindFirst.mockResolvedValue({
      id: "club-inv-1",
      targetIdentifier: "other@example.com",
      targetUserId: "other-user",
      acceptedAt: new Date(),
      declinedAt: null,
      cancelledAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await clubStaffInvitesPatch(
      new NextRequest("http://localhost/api/padel/clubs/22/staff/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: "club-inv-1", action: "CANCEL" }),
      }),
    );

    expect(res.status).toBe(409);
    expect(padelClubStaffInviteUpdate).not.toHaveBeenCalled();
  });
});
