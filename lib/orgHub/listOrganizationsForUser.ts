import {
  GroupMembershipRequestStatus,
  GroupMembershipRequestType,
  GroupOwnerTransferStatus,
  OrganizationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";

export type OrgHubOrganizationPayload = {
  organizationId: number;
  groupId: number;
  role: string;
  lastUsedAt: string | null;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    status: string | null;
    brandingAvatarUrl: string | null;
  };
  group: {
    id: number;
    name: string | null;
    ownerUserId: string | null;
    viewerIsGroupOwner: boolean;
    organizationCount: number;
    pendingJoinCount: number;
    pendingExitCount: number;
    actionableCount: number;
  };
};

export async function listOrgHubOrganizationsForUser(params: {
  userId: string;
  allowedStatuses?: OrganizationStatus[];
}): Promise<OrgHubOrganizationPayload[]> {
  const memberships = await listEffectiveOrganizationMembershipsForUser({
    userId: params.userId,
    allowedStatuses: params.allowedStatuses ?? [
      OrganizationStatus.ACTIVE,
      OrganizationStatus.SUSPENDED,
    ],
  });

  if (memberships.length === 0) return [];

  const groupIds = Array.from(new Set(memberships.map((membership) => membership.groupId)));

  const [groups, openRequests, pendingTransfers] = await Promise.all([
    prisma.organizationGroup.findMany({
      where: { id: { in: groupIds } },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        _count: { select: { organizations: true } },
      },
    }),
    prisma.groupMembershipRequest.findMany({
      where: {
        groupId: { in: groupIds },
        status: {
          in: [
            GroupMembershipRequestStatus.PENDING_CODES,
            GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
            GroupMembershipRequestStatus.LOCKED,
          ],
        },
      },
      select: {
        groupId: true,
        type: true,
        currentOrgOwnerUserId: true,
        targetOwnerUserId: true,
      },
    }),
    prisma.organizationGroupOwnerTransfer.findMany({
      where: {
        groupId: { in: groupIds },
        status: GroupOwnerTransferStatus.PENDING,
      },
      select: {
        groupId: true,
        toUserId: true,
      },
    }),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const requestsByGroupId = new Map<
    number,
    { pendingJoinCount: number; pendingExitCount: number; actionableCount: number }
  >();

  for (const request of openRequests) {
    const current = requestsByGroupId.get(request.groupId) ?? {
      pendingJoinCount: 0,
      pendingExitCount: 0,
      actionableCount: 0,
    };
    if (request.type === GroupMembershipRequestType.JOIN) {
      current.pendingJoinCount += 1;
    } else {
      current.pendingExitCount += 1;
    }

    const groupOwnerUserId = groupById.get(request.groupId)?.ownerUserId ?? null;
    const isActionableByUser =
      groupOwnerUserId === params.userId ||
      request.currentOrgOwnerUserId === params.userId ||
      request.targetOwnerUserId === params.userId;

    if (isActionableByUser) {
      current.actionableCount += 1;
    }
    requestsByGroupId.set(request.groupId, current);
  }

  for (const transfer of pendingTransfers) {
    const current = requestsByGroupId.get(transfer.groupId) ?? {
      pendingJoinCount: 0,
      pendingExitCount: 0,
      actionableCount: 0,
    };
    const groupOwnerUserId = groupById.get(transfer.groupId)?.ownerUserId ?? null;
    const isActionableByUser = transfer.toUserId === params.userId || groupOwnerUserId === params.userId;
    if (isActionableByUser) {
      current.actionableCount += 1;
    }
    requestsByGroupId.set(transfer.groupId, current);
  }

  return memberships.map((membership) => {
    const requestCounts = requestsByGroupId.get(membership.groupId) ?? {
      pendingJoinCount: 0,
      pendingExitCount: 0,
      actionableCount: 0,
    };
    const group = groupById.get(membership.groupId);

    return {
      organizationId: membership.organizationId,
      groupId: membership.groupId,
      role: membership.role,
      lastUsedAt: null,
      organization: {
        id: membership.organization.id,
        username: membership.organization.username,
        publicName: membership.organization.publicName,
        businessName: membership.organization.businessName,
        entityType: membership.organization.entityType,
        status: membership.organization.status,
        brandingAvatarUrl: membership.organization.brandingAvatarUrl ?? null,
      },
      group: {
        id: membership.groupId,
        name: group?.name?.trim() ? group.name.trim() : null,
        ownerUserId: group?.ownerUserId ?? null,
        viewerIsGroupOwner: (group?.ownerUserId ?? null) === params.userId,
        organizationCount: group?._count.organizations ?? 1,
        pendingJoinCount: requestCounts.pendingJoinCount,
        pendingExitCount: requestCounts.pendingExitCount,
        actionableCount: requestCounts.actionableCount,
      },
    };
  });
}
