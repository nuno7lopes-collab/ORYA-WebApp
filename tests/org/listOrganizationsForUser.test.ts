import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationStatus } from "@prisma/client";

const listEffectiveOrganizationMembershipsForUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  organizationGroup: { findMany: vi.fn() },
  groupMembershipRequest: { findMany: vi.fn() },
  organizationGroupOwnerTransfer: { findMany: vi.fn() },
}));

vi.mock("@/lib/organizationMembers", () => ({
  listEffectiveOrganizationMembershipsForUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { listOrgHubOrganizationsForUser } from "@/lib/orgHub/listOrganizationsForUser";

describe("listOrgHubOrganizationsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when user has no memberships", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValue([]);

    const result = await listOrgHubOrganizationsForUser({ userId: "u1" });

    expect(result).toEqual([]);
    expect(prisma.organizationGroup.findMany).not.toHaveBeenCalled();
    expect(prisma.groupMembershipRequest.findMany).not.toHaveBeenCalled();
  });

  it("aggregates group pending requests and actionable counts per group", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValue([
      {
        organizationId: 1,
        groupId: 10,
        role: "OWNER",
        organization: {
          id: 1,
          username: "org-one",
          publicName: "Org One",
          businessName: "Org One Lda",
          entityType: "EMPRESA",
          status: OrganizationStatus.ACTIVE,
          brandingAvatarUrl: null,
        },
      },
      {
        organizationId: 2,
        groupId: 10,
        role: "ADMIN",
        organization: {
          id: 2,
          username: "org-two",
          publicName: "Org Two",
          businessName: "Org Two Lda",
          entityType: "ASSOCIACAO",
          status: OrganizationStatus.SUSPENDED,
          brandingAvatarUrl: "https://cdn.example.com/org-two.png",
        },
      },
    ]);

    prisma.organizationGroup.findMany.mockResolvedValue([
      {
        id: 10,
        ownerUserId: "owner-10",
        _count: { organizations: 2 },
      },
    ]);

    prisma.groupMembershipRequest.findMany.mockResolvedValue([
      {
        groupId: 10,
        organizationId: 1,
        type: "JOIN",
        currentOrgOwnerUserId: "other-owner",
        targetOwnerUserId: null,
      },
      {
        groupId: 10,
        organizationId: 1,
        type: "EXIT_KEEP_OWNER",
        currentOrgOwnerUserId: "u1",
        targetOwnerUserId: null,
      },
      {
        groupId: 10,
        organizationId: 2,
        type: "EXIT_TRANSFER_OWNER",
        currentOrgOwnerUserId: "other-owner",
        targetOwnerUserId: "u1",
      },
    ]);

    prisma.organizationGroupOwnerTransfer.findMany.mockResolvedValue([
      {
        groupId: 10,
        toUserId: "u1",
      },
    ]);

    const result = await listOrgHubOrganizationsForUser({ userId: "u1" });
    const byOrgId = new Map(result.map((item) => [item.organizationId, item]));

    expect(result).toHaveLength(2);
    expect(listEffectiveOrganizationMembershipsForUser).toHaveBeenCalledWith({
      userId: "u1",
      allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
    });

    expect(byOrgId.get(1)?.group.pendingJoinCount).toBe(1);
    expect(byOrgId.get(1)?.group.pendingExitCount).toBe(2);
    expect(byOrgId.get(1)?.group.actionableCount).toBe(3);
    expect(byOrgId.get(1)?.group.viewerIsGroupOwner).toBe(false);

    expect(byOrgId.get(2)?.group.pendingJoinCount).toBe(1);
    expect(byOrgId.get(2)?.group.pendingExitCount).toBe(2);
    expect(byOrgId.get(2)?.group.actionableCount).toBe(3);
    expect(byOrgId.get(2)?.group.viewerIsGroupOwner).toBe(false);

    expect(byOrgId.get(1)?.group.organizationCount).toBe(2);
    expect(byOrgId.get(2)?.group.organizationCount).toBe(2);
  });
});
