import {
  GroupMembershipRequestStatus,
  GroupMembershipRequestType,
  GroupOwnerTransferStatus,
  OrganizationMemberRole,
  OrganizationStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listEffectiveOrganizationMembershipsForUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  organizationGroup: { findMany: vi.fn() },
  groupMembershipRequest: { findMany: vi.fn() },
  organizationGroupOwnerTransfer: { findMany: vi.fn() },
  organizationGroupMember: { findMany: vi.fn() },
}));

vi.mock("@/lib/organizationMembers", () => ({
  listEffectiveOrganizationMembershipsForUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { listOrgHubGroupsForUser, resolveGroupDisplayName } from "@/lib/orgHub/listGroupsForUser";

describe("listOrgHubGroupsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when user has no groups or requests", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValue([]);
    prisma.organizationGroup.findMany.mockResolvedValueOnce([]);
    prisma.groupMembershipRequest.findMany.mockResolvedValue([]);
    prisma.organizationGroupOwnerTransfer.findMany.mockResolvedValue([]);

    const result = await listOrgHubGroupsForUser({ userId: "u1" });

    expect(result).toEqual([]);
    expect(prisma.organizationGroup.findMany).toHaveBeenCalledTimes(1);
  });

  it("builds group governance payload with candidates and scoped visibility", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValue([
      {
        organizationId: 1,
        role: OrganizationMemberRole.OWNER,
        groupId: 10,
        organization: {
          id: 1,
          publicName: "Top Padel",
          businessName: "Top Padel Lda",
          username: "top-padel",
          entityType: "CLUBE",
          status: OrganizationStatus.ACTIVE,
        },
      },
      {
        organizationId: 2,
        role: OrganizationMemberRole.OWNER,
        groupId: 20,
        organization: {
          id: 2,
          publicName: "Academia Sul",
          businessName: "Academia Sul",
          username: "academia-sul",
          entityType: "ACADEMIA",
          status: OrganizationStatus.ACTIVE,
        },
      },
    ] as any);

    prisma.organizationGroup.findMany
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([
        {
          id: 10,
          name: "Grupo Norte",
          ownerUserId: "u1",
          showLinkedOrganizationsPublicly: true,
          _count: { organizations: 2 },
          organizations: [
            {
              id: 1,
              publicName: "Top Padel",
              businessName: "Top Padel Lda",
              username: "top-padel",
              status: OrganizationStatus.ACTIVE,
              entityType: "CLUBE",
            },
            {
              id: 3,
              publicName: "Top Hub",
              businessName: "Top Hub",
              username: "top-hub",
              status: OrganizationStatus.SUSPENDED,
              entityType: "HOLDING",
            },
          ],
        },
        {
          id: 20,
          name: null,
          ownerUserId: "u9",
          showLinkedOrganizationsPublicly: false,
          _count: { organizations: 2 },
          organizations: [
            {
              id: 2,
              publicName: "Academia Sul",
              businessName: "Academia Sul",
              username: "academia-sul",
              status: OrganizationStatus.ACTIVE,
              entityType: "ACADEMIA",
            },
            {
              id: 4,
              publicName: "Oculta",
              businessName: "Oculta",
              username: "oculta",
              status: OrganizationStatus.ACTIVE,
              entityType: "OUTRA",
            },
          ],
        },
      ]);

    prisma.groupMembershipRequest.findMany.mockResolvedValue([
      {
        id: "r-join",
        type: GroupMembershipRequestType.JOIN,
        status: GroupMembershipRequestStatus.PENDING_CODES,
        groupId: 10,
        organizationId: 2,
        expiresAt: new Date("2026-03-01T10:00:00.000Z"),
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        codeExpiresAt: null,
        emailTokenExpiresAt: null,
        resendCount: 0,
        currentOrgOwnerUserId: "u1",
        targetOwnerUserId: null,
        group: { ownerUserId: "u1" },
        organization: {
          id: 2,
          publicName: "Academia Sul",
          businessName: "Academia Sul",
        },
      },
    ]);

    prisma.organizationGroupOwnerTransfer.findMany.mockResolvedValue([
      {
        id: "t-1",
        status: GroupOwnerTransferStatus.PENDING,
        groupId: 10,
        fromUserId: "u1",
        toUserId: "u2",
        expiresAt: new Date("2026-03-02T10:00:00.000Z"),
        createdAt: new Date("2026-02-20T10:00:00.000Z"),
      },
    ]);

    prisma.organizationGroupMember.findMany.mockResolvedValue([]);

    const result = await listOrgHubGroupsForUser({ userId: "u1" });
    const byGroupId = new Map(result.map((group) => [group.groupId, group]));

    expect(result).toHaveLength(2);

    const group10 = byGroupId.get(10);
    expect(group10?.viewerIsGroupOwner).toBe(true);
    expect(group10?.showLinkedOrganizationsPublicly).toBe(true);
    expect(group10?.organizations).toHaveLength(2);
    expect(group10?.joinCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: 2,
          hasOpenJoinRequest: true,
        }),
      ]),
    );
    expect(group10?.openRequests).toHaveLength(1);
    expect(group10?.pendingTransfers).toHaveLength(1);

    const group20 = byGroupId.get(20);
    expect(group20?.viewerIsGroupOwner).toBe(false);
    expect(group20?.showLinkedOrganizationsPublicly).toBe(false);
    expect(group20?.organizations).toHaveLength(1);
    expect(group20?.organizations[0]?.organizationId).toBe(2);
  });

  it("aplica filtro por groupId quando pedido", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValue([
      {
        organizationId: 1,
        role: OrganizationMemberRole.OWNER,
        groupId: 10,
        organization: {
          id: 1,
          publicName: "Org Norte",
          businessName: "Org Norte",
          username: "org-norte",
          entityType: "CLUBE",
          status: OrganizationStatus.ACTIVE,
        },
      },
      {
        organizationId: 2,
        role: OrganizationMemberRole.OWNER,
        groupId: 20,
        organization: {
          id: 2,
          publicName: "Org Sul",
          businessName: "Org Sul",
          username: "org-sul",
          entityType: "ACADEMIA",
          status: OrganizationStatus.ACTIVE,
        },
      },
    ] as any);

    prisma.organizationGroup.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 20,
          name: "Grupo Sul",
          ownerUserId: "u1",
          showLinkedOrganizationsPublicly: true,
          _count: { organizations: 1 },
          organizations: [
            {
              id: 2,
              publicName: "Org Sul",
              businessName: "Org Sul",
              username: "org-sul",
              status: OrganizationStatus.ACTIVE,
              entityType: "ACADEMIA",
            },
          ],
        },
      ]);

    prisma.groupMembershipRequest.findMany.mockResolvedValue([]);
    prisma.organizationGroupOwnerTransfer.findMany.mockResolvedValue([]);
    prisma.organizationGroupMember.findMany.mockResolvedValue([]);

    const result = await listOrgHubGroupsForUser({ userId: "u1", groupId: 20 });

    expect(result).toHaveLength(1);
    expect(result[0]?.groupId).toBe(20);
    expect(prisma.organizationGroup.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: { in: [20] } },
      }),
    );
  });

  it("resolveGroupDisplayName usa fallback consistente", () => {
    expect(resolveGroupDisplayName("  Grupo Centro  ", 9)).toBe("Grupo Centro");
    expect(resolveGroupDisplayName("", 9)).toBe("Grupo #9");
    expect(resolveGroupDisplayName(null, 9)).toBe("Grupo #9");
  });
});
