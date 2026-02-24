import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  organizationGroup: {
    findUnique: vi.fn(),
  },
  organizationGroupMember: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  organization: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth/requireUser", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/domain/groupGovernanceInvariants", () => ({ enforceGroupGovernanceInvariants: vi.fn() }));

import { GET as governanceGet, PATCH as governancePatch } from "@/app/api/org-hub/groups/[groupId]/governance/route";
import { POST as governanceMemberPost } from "@/app/api/org-hub/groups/[groupId]/governance/members/route";

describe("group governance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("denies governance GET when user is not owner nor governance", async () => {
    prisma.organizationGroup.findUnique.mockResolvedValue({ id: 1, name: null, ownerUserId: "owner-1" });
    prisma.organizationGroupMember.findFirst.mockResolvedValue(null);

    const res = await governanceGet(new NextRequest("http://localhost/api/org-hub/groups/1/governance"), {
      params: Promise.resolve({ groupId: "1" }),
    });

    expect(res.status).toBe(403);
  });

  it("denies governance PATCH when user is not owner", async () => {
    prisma.organizationGroup.findUnique.mockResolvedValue({ id: 2, ownerUserId: "owner-2" });

    const res = await governancePatch(
      new NextRequest("http://localhost/api/org-hub/groups/2/governance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Grupo Norte" }),
      }),
      { params: Promise.resolve({ groupId: "2" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects invalid governance member role", async () => {
    prisma.organizationGroup.findUnique.mockResolvedValue({ id: 3, ownerUserId: "user-1" });

    const res = await governanceMemberPost(
      new NextRequest("http://localhost/api/org-hub/groups/3/governance/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIdentifier: "user@example.com", role: "OWNER" }),
      }),
      { params: Promise.resolve({ groupId: "3" }) },
    );

    expect(res.status).toBe(400);
  });

  it("allows group owner to update linked organizations visibility", async () => {
    prisma.organizationGroup.findUnique.mockResolvedValue({
      id: 4,
      ownerUserId: "user-1",
      name: "Grupo Norte",
      showLinkedOrganizationsPublicly: true,
    });
    const update = vi.fn().mockResolvedValue({
      id: 4,
      ownerUserId: "user-1",
      name: "Grupo Norte",
      showLinkedOrganizationsPublicly: false,
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({ organizationGroup: { update } }),
    );

    const res = await governancePatch(
      new NextRequest("http://localhost/api/org-hub/groups/4/governance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showLinkedOrganizationsPublicly: false }),
      }),
      { params: Promise.resolve({ groupId: "4" }) },
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: expect.objectContaining({ showLinkedOrganizationsPublicly: false }),
      }),
    );
  });

  it("rejects invalid linked organizations visibility payload", async () => {
    prisma.organizationGroup.findUnique.mockResolvedValue({
      id: 5,
      ownerUserId: "user-1",
      name: "Grupo Centro",
      showLinkedOrganizationsPublicly: true,
    });

    const res = await governancePatch(
      new NextRequest("http://localhost/api/org-hub/groups/5/governance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showLinkedOrganizationsPublicly: "nope" }),
      }),
      { params: Promise.resolve({ groupId: "5" }) },
    );

    expect(res.status).toBe(400);
  });
});
