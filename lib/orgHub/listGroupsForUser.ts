import {
  GroupMembershipRequestStatus,
  GroupMembershipRequestType,
  GroupOwnerTransferStatus,
  OrganizationMemberRole,
  OrganizationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { resolveGroupDisplayName } from "@/lib/orgHub/groupDisplayName";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";

export type OrgHubGroupOrganization = {
  organizationId: number;
  name: string;
  username: string | null;
  status: string | null;
  entityType: string | null;
  viewerRole: string | null;
  viewerIsOrgOwner: boolean;
};

export type OrgHubGroupJoinCandidate = {
  organizationId: number;
  name: string;
  status: string | null;
  hasOpenJoinRequest: boolean;
};

export type OrgHubGroupOpenRequest = {
  id: string;
  type: GroupMembershipRequestType;
  status: GroupMembershipRequestStatus;
  groupId: number;
  organizationId: number;
  organizationName: string;
  expiresAt: string | null;
  createdAt: string;
  codeExpiresAt: string | null;
  emailTokenExpiresAt: string | null;
  resendCount: number;
  canActAsGroupOwner: boolean;
  canActAsOrgOwner: boolean;
  canActAsTargetOwner: boolean;
  isActionable: boolean;
};

export type OrgHubGroupOwnerTransfer = {
  id: string;
  status: GroupOwnerTransferStatus;
  groupId: number;
  fromUserId: string;
  toUserId: string;
  fromLabel: string;
  toLabel: string;
  expiresAt: string;
  createdAt: string;
  isActionable: boolean;
};

export type OrgHubGroupGovernanceMember = {
  userId: string;
  role: OrganizationMemberRole;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type OrgHubGroupPayload = {
  groupId: number;
  groupName: string | null;
  ownerUserId: string | null;
  showLinkedOrganizationsPublicly: boolean;
  viewerIsGroupOwner: boolean;
  viewerIsGovernance: boolean;
  governance: {
    coOwnerCount: number;
    adminCount: number;
  };
  governanceMembers: OrgHubGroupGovernanceMember[];
  organizationCount: number;
  organizations: OrgHubGroupOrganization[];
  joinCandidates: OrgHubGroupJoinCandidate[];
  openRequests: OrgHubGroupOpenRequest[];
  pendingTransfers: OrgHubGroupOwnerTransfer[];
  actionableRequestCount: number;
};

const OPEN_REQUEST_STATUSES: GroupMembershipRequestStatus[] = [
  GroupMembershipRequestStatus.PENDING_CODES,
  GroupMembershipRequestStatus.PENDING_EMAIL_CONFIRMATIONS,
  GroupMembershipRequestStatus.LOCKED,
];

const GROUP_ALLOWED_STATUSES: OrganizationStatus[] = [
  OrganizationStatus.ACTIVE,
  OrganizationStatus.SUSPENDED,
];

function resolveOrgName(input: {
  publicName: string | null;
  businessName: string | null;
  organizationId?: number;
}) {
  return (
    input.publicName?.trim() ||
    input.businessName?.trim() ||
    (typeof input.organizationId === "number" ? `Organização #${input.organizationId}` : "Organização")
  );
}

export async function listOrgHubGroupsForUser(params: {
  userId: string;
  groupId?: number;
}): Promise<OrgHubGroupPayload[]> {
  const requestedGroupId =
    typeof params.groupId === "number" && Number.isFinite(params.groupId) && params.groupId > 0
      ? Math.floor(params.groupId)
      : null;

  const memberships = await listEffectiveOrganizationMembershipsForUser({
    userId: params.userId,
    allowedStatuses: GROUP_ALLOWED_STATUSES,
  });

  const membershipsByOrgId = new Map(memberships.map((membership) => [membership.organizationId, membership]));
  const ownerMemberships = memberships.filter((membership) => membership.role === OrganizationMemberRole.OWNER);

  const ownedGroups = await prisma.organizationGroup.findMany({
    where: { ownerUserId: params.userId },
    select: { id: true },
  });

  const userGroupIds = new Set<number>([
    ...memberships.map((membership) => membership.groupId),
    ...ownedGroups.map((group) => group.id),
  ]);

  const requestOrConditions: Array<Record<string, unknown>> = [
    { currentOrgOwnerUserId: params.userId },
    { targetOwnerUserId: params.userId },
    { group: { ownerUserId: params.userId } },
  ];

  const [openRequestsRaw, pendingTransfersRaw] = await Promise.all([
    prisma.groupMembershipRequest.findMany({
      where: {
        status: { in: OPEN_REQUEST_STATUSES },
        OR: requestOrConditions,
      },
      select: {
        id: true,
        type: true,
        status: true,
        groupId: true,
        organizationId: true,
        expiresAt: true,
        createdAt: true,
        codeExpiresAt: true,
        emailTokenExpiresAt: true,
        resendCount: true,
        currentOrgOwnerUserId: true,
        targetOwnerUserId: true,
        group: { select: { ownerUserId: true } },
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 400,
    }),
    prisma.organizationGroupOwnerTransfer.findMany({
      where: {
        status: GroupOwnerTransferStatus.PENDING,
        OR: [
          { toUserId: params.userId },
          { fromUserId: params.userId },
          { group: { ownerUserId: params.userId } },
        ],
      },
      select: {
        id: true,
        status: true,
        groupId: true,
        fromUserId: true,
        toUserId: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 120,
    }),
  ]);

  const openRequests =
    requestedGroupId === null
      ? openRequestsRaw
      : openRequestsRaw.filter((request) => request.groupId === requestedGroupId);
  const pendingTransfers =
    requestedGroupId === null
      ? pendingTransfersRaw
      : pendingTransfersRaw.filter((transfer) => transfer.groupId === requestedGroupId);

  const discoveredGroupIds = new Set<number>([
    ...Array.from(userGroupIds),
    ...openRequests.map((request) => request.groupId),
    ...pendingTransfers.map((transfer) => transfer.groupId),
  ]);

  if (requestedGroupId !== null && !discoveredGroupIds.has(requestedGroupId)) {
    return [];
  }

  const allGroupIds = requestedGroupId !== null ? new Set<number>([requestedGroupId]) : discoveredGroupIds;

  if (allGroupIds.size === 0) {
    return [];
  }

  const [groups, governanceMembers] = await Promise.all([
    prisma.organizationGroup.findMany({
      where: { id: { in: Array.from(allGroupIds) } },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        showLinkedOrganizationsPublicly: true,
        _count: { select: { organizations: true } },
        organizations: {
          where: { status: { in: GROUP_ALLOWED_STATUSES } },
          select: {
            id: true,
            publicName: true,
            businessName: true,
            username: true,
            status: true,
            entityType: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.organizationGroupMember.findMany({
      where: {
        groupId: { in: Array.from(allGroupIds) },
        isGovernance: true,
        role: {
          in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN],
        },
      },
      select: {
        groupId: true,
        userId: true,
        role: true,
        scopeAllOrgs: true,
        user: {
          select: {
            fullName: true,
            username: true,
            avatarUrl: true,
            isDeleted: true,
          },
        },
      },
    }),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const viewerGovernanceGroupIds = new Set(
    governanceMembers
      .filter((member) => member.userId === params.userId && member.scopeAllOrgs)
      .map((member) => member.groupId),
  );
  const governanceCountsByGroupId = new Map<number, { coOwnerCount: number; adminCount: number }>();
  const governanceMembersByGroupId = new Map<number, OrgHubGroupGovernanceMember[]>();
  for (const member of governanceMembers) {
    const current = governanceCountsByGroupId.get(member.groupId) ?? { coOwnerCount: 0, adminCount: 0 };
    if (member.role === OrganizationMemberRole.CO_OWNER) current.coOwnerCount += 1;
    if (member.role === OrganizationMemberRole.ADMIN) current.adminCount += 1;
    governanceCountsByGroupId.set(member.groupId, current);

    const list = governanceMembersByGroupId.get(member.groupId) ?? [];
    list.push({
      userId: member.userId,
      role: member.role,
      fullName: member.user?.isDeleted ? null : member.user?.fullName ?? null,
      username: member.user?.isDeleted ? null : member.user?.username ?? null,
      avatarUrl: member.user?.isDeleted ? null : member.user?.avatarUrl ?? null,
    });
    governanceMembersByGroupId.set(member.groupId, list);
  }
  const openJoinRequestKey = new Set(
    openRequests
      .filter((request) => request.type === GroupMembershipRequestType.JOIN)
      .map((request) => `${request.groupId}:${request.organizationId}`),
  );

  const result: OrgHubGroupPayload[] = groups.map((group) => {
    const viewerIsGroupOwner = group.ownerUserId === params.userId;
    const viewerIsGovernance = viewerIsGroupOwner || viewerGovernanceGroupIds.has(group.id);
    const governance = governanceCountsByGroupId.get(group.id) ?? { coOwnerCount: 0, adminCount: 0 };
    const governanceMembersList = governanceMembersByGroupId.get(group.id) ?? [];

    const organizations = group.organizations
      .filter((organization) => {
        if (viewerIsGroupOwner) return true;
        const membership = membershipsByOrgId.get(organization.id);
        return membership?.groupId === group.id;
      })
      .map((organization) => {
        const membership = membershipsByOrgId.get(organization.id);
        const viewerRole = membership?.groupId === group.id ? membership.role : null;
        const viewerIsOrgOwner = viewerRole === OrganizationMemberRole.OWNER;
        return {
          organizationId: organization.id,
          name: resolveOrgName({
            publicName: organization.publicName,
            businessName: organization.businessName,
            organizationId: organization.id,
          }),
          username: organization.username,
          status: organization.status,
          entityType: organization.entityType,
          viewerRole,
          viewerIsOrgOwner,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));

    const inGroupOrgIds = new Set(group.organizations.map((organization) => organization.id));

    const joinCandidates = viewerIsGroupOwner
      ? ownerMemberships
          .filter((membership) => !inGroupOrgIds.has(membership.organizationId))
          .map((membership) => ({
            organizationId: membership.organizationId,
            name: resolveOrgName({
              publicName: membership.organization.publicName,
              businessName: membership.organization.businessName,
              organizationId: membership.organizationId,
            }),
            status: membership.organization.status,
            hasOpenJoinRequest: openJoinRequestKey.has(`${group.id}:${membership.organizationId}`),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt"))
      : [];

    const groupRequests = openRequests
      .filter((request) => request.groupId === group.id)
      .map((request) => {
        const canActAsGroupOwner = request.group.ownerUserId === params.userId;
        const canActAsOrgOwner = request.currentOrgOwnerUserId === params.userId;
        const canActAsTargetOwner = request.targetOwnerUserId === params.userId;
        return {
          id: request.id,
          type: request.type,
          status: request.status,
          groupId: request.groupId,
          organizationId: request.organizationId,
          organizationName: resolveOrgName({
            publicName: request.organization.publicName,
            businessName: request.organization.businessName,
            organizationId: request.organization.id,
          }),
          expiresAt: request.expiresAt?.toISOString() ?? null,
          createdAt: request.createdAt.toISOString(),
          codeExpiresAt: request.codeExpiresAt?.toISOString() ?? null,
          emailTokenExpiresAt: request.emailTokenExpiresAt?.toISOString() ?? null,
          resendCount: request.resendCount,
          canActAsGroupOwner,
          canActAsOrgOwner,
          canActAsTargetOwner,
          isActionable: canActAsGroupOwner || canActAsOrgOwner || canActAsTargetOwner,
        };
      });

    const groupTransfers = pendingTransfers
      .filter((transfer) => transfer.groupId === group.id)
      .map((transfer) => ({
        id: transfer.id,
        status: transfer.status,
        groupId: transfer.groupId,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        fromLabel: transfer.fromUserId === params.userId ? "Tu" : transfer.fromUserId,
        toLabel: transfer.toUserId === params.userId ? "Tu" : transfer.toUserId,
        expiresAt: transfer.expiresAt.toISOString(),
        createdAt: transfer.createdAt.toISOString(),
        isActionable: transfer.fromUserId === params.userId || transfer.toUserId === params.userId,
      }));

    return {
      groupId: group.id,
      groupName: group.name?.trim() ? group.name.trim() : null,
      ownerUserId: group.ownerUserId,
      showLinkedOrganizationsPublicly: group.showLinkedOrganizationsPublicly !== false,
      viewerIsGroupOwner,
      viewerIsGovernance,
      governance,
      governanceMembers: governanceMembersList.sort((a, b) => {
        const order: Record<string, number> = { OWNER: 0, CO_OWNER: 1, ADMIN: 2 };
        const aOrder = order[String(a.role).toUpperCase()] ?? 9;
        const bOrder = order[String(b.role).toUpperCase()] ?? 9;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.userId.localeCompare(b.userId);
      }),
      organizationCount: group._count.organizations,
      organizations,
      joinCandidates,
      openRequests: groupRequests,
      pendingTransfers: groupTransfers,
      actionableRequestCount: groupRequests.filter((request) => request.isActionable).length,
    };
  });

  for (const request of openRequests) {
    if (groupById.has(request.groupId)) continue;
    const canActAsGroupOwner = request.group.ownerUserId === params.userId;
    const canActAsOrgOwner = request.currentOrgOwnerUserId === params.userId;
    const canActAsTargetOwner = request.targetOwnerUserId === params.userId;
    result.push({
      groupId: request.groupId,
      groupName: null,
      ownerUserId: request.group.ownerUserId,
      showLinkedOrganizationsPublicly: true,
      viewerIsGroupOwner: canActAsGroupOwner,
      viewerIsGovernance: canActAsGroupOwner,
      governance: { coOwnerCount: 0, adminCount: 0 },
      governanceMembers: [],
      organizationCount: 0,
      organizations: [],
      joinCandidates: [],
      openRequests: [
        {
          id: request.id,
          type: request.type,
          status: request.status,
          groupId: request.groupId,
          organizationId: request.organizationId,
          organizationName: resolveOrgName({
            publicName: request.organization.publicName,
            businessName: request.organization.businessName,
            organizationId: request.organization.id,
          }),
          expiresAt: request.expiresAt?.toISOString() ?? null,
          createdAt: request.createdAt.toISOString(),
          codeExpiresAt: request.codeExpiresAt?.toISOString() ?? null,
          emailTokenExpiresAt: request.emailTokenExpiresAt?.toISOString() ?? null,
          resendCount: request.resendCount,
          canActAsGroupOwner,
          canActAsOrgOwner,
          canActAsTargetOwner,
          isActionable: canActAsGroupOwner || canActAsOrgOwner || canActAsTargetOwner,
        },
      ],
      pendingTransfers: [],
      actionableRequestCount: canActAsGroupOwner || canActAsOrgOwner || canActAsTargetOwner ? 1 : 0,
    });
  }

  return result.sort((a, b) => {
    const aWeight = a.viewerIsGroupOwner ? 1 : 0;
    const bWeight = b.viewerIsGroupOwner ? 1 : 0;
    if (aWeight !== bWeight) return bWeight - aWeight;
    return a.groupId - b.groupId;
  });
}
