import {
  OrganizationMemberRole,
  OrganizationRolePack,
  OrganizationStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export type EffectiveOrganizationMember = {
  userId: string;
  role: OrganizationMemberRole;
  rolePack: OrganizationRolePack | null;
  groupMemberId: string;
  groupId: number;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectiveOrganizationMembershipForUser = {
  organizationId: number;
  role: OrganizationMemberRole;
  rolePack: OrganizationRolePack | null;
  groupMemberId: string;
  groupId: number;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    status: OrganizationStatus | null;
    brandingAvatarUrl: string | null;
    brandingPrimaryColor: string | null;
    brandingSecondaryColor: string | null;
    language: string | null;
    officialEmail: string | null;
    officialEmailVerifiedAt: Date | null;
    organizationKind: string | null;
    primaryModule: string | null;
  };
};

async function resolveOrgGroupId(organizationId: number, client: PrismaClientLike) {
  if (!organizationId || !Number.isFinite(organizationId)) return null;
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { groupId: true },
  });
  return org?.groupId ?? null;
}

export async function listEffectiveOrganizationMembers(params: {
  organizationId: number;
  client?: Prisma.TransactionClient;
  userIds?: string[];
  roles?: OrganizationMemberRole[];
}): Promise<EffectiveOrganizationMember[]> {
  const { organizationId, client, userIds, roles } = params;
  const db = client ?? prisma;
  const groupId = await resolveOrgGroupId(organizationId, db);
  if (!groupId) return [];

  const members = await db.organizationGroupMember.findMany({
    where: {
      groupId,
      ...(Array.isArray(userIds) && userIds.length > 0 ? { userId: { in: userIds } } : {}),
      OR: [{ scopeAllOrgs: true }, { scopeOrgIds: { has: organizationId } }],
    },
    select: {
      id: true,
      userId: true,
      role: true,
      rolePack: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
  });
  if (!members.length) return [];

  const overrides = await db.organizationGroupMemberOrganizationOverride.findMany({
    where: {
      organizationId,
      groupMemberId: { in: members.map((member) => member.id) },
    },
    select: {
      groupMemberId: true,
      roleOverride: true,
      revokedAt: true,
    },
  });
  const overrideByMemberId = new Map(overrides.map((entry) => [entry.groupMemberId, entry]));

  const resolved: EffectiveOrganizationMember[] = [];
  for (const member of members) {
    const override = overrideByMemberId.get(member.id);
    if (override?.revokedAt) continue;
    const role = override?.roleOverride ?? member.role;
    if (roles && !roles.includes(role)) continue;
    resolved.push({
      userId: member.userId,
      role,
      rolePack: member.rolePack ?? null,
      groupMemberId: member.id,
      groupId,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    });
  }
  return resolved;
}

export async function getEffectiveOrganizationMember(params: {
  organizationId: number;
  userId: string;
  client?: Prisma.TransactionClient;
}): Promise<EffectiveOrganizationMember | null> {
  const { organizationId, userId, client } = params;
  const rows = await listEffectiveOrganizationMembers({
    organizationId,
    client,
    userIds: [userId],
  });
  return rows[0] ?? null;
}

export async function countEffectiveOrganizationMembersByRole(params: {
  organizationId: number;
  role: OrganizationMemberRole;
  client?: Prisma.TransactionClient;
  excludeUserId?: string | null;
}): Promise<number> {
  const { organizationId, role, client, excludeUserId } = params;
  const rows = await listEffectiveOrganizationMembers({
    organizationId,
    client,
    roles: [role],
  });
  if (!excludeUserId) return rows.length;
  return rows.filter((row) => row.userId !== excludeUserId).length;
}

export async function listEffectiveOrganizationMemberUserIdsByRoles(params: {
  organizationId: number;
  roles: OrganizationMemberRole[];
  client?: Prisma.TransactionClient;
}): Promise<string[]> {
  const { organizationId, roles, client } = params;
  const members = await listEffectiveOrganizationMembers({ organizationId, roles, client });
  return Array.from(new Set(members.map((member) => member.userId)));
}

export async function listEffectiveOrganizationMembershipsForUser(params: {
  userId: string;
  roles?: OrganizationMemberRole[];
  allowedStatuses?: OrganizationStatus[];
  client?: Prisma.TransactionClient;
}): Promise<EffectiveOrganizationMembershipForUser[]> {
  const { userId, roles, allowedStatuses, client } = params;
  if (!userId) return [];
  const db = client ?? prisma;

  const members = await db.organizationGroupMember.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      groupId: true,
      role: true,
      rolePack: true,
      scopeAllOrgs: true,
      scopeOrgIds: true,
      createdAt: true,
      updatedAt: true,
      group: {
        select: {
          organizations: {
            where:
              Array.isArray(allowedStatuses) && allowedStatuses.length > 0
                ? { status: { in: allowedStatuses } }
                : undefined,
            select: {
              id: true,
              username: true,
              publicName: true,
              businessName: true,
              entityType: true,
              status: true,
              brandingAvatarUrl: true,
              brandingPrimaryColor: true,
              brandingSecondaryColor: true,
              language: true,
              officialEmail: true,
              officialEmailVerifiedAt: true,
              organizationKind: true,
              primaryModule: true,
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!members.length) return [];

  const overrides = await db.organizationGroupMemberOrganizationOverride.findMany({
    where: { groupMemberId: { in: members.map((member) => member.id) } },
    select: {
      groupMemberId: true,
      organizationId: true,
      roleOverride: true,
      revokedAt: true,
    },
  });
  const overrideByMemberOrg = new Map(
    overrides.map((entry) => [`${entry.groupMemberId}:${entry.organizationId}`, entry]),
  );

  const results: EffectiveOrganizationMembershipForUser[] = [];
  for (const member of members) {
    const scopeOrgIds = member.scopeOrgIds ?? [];
    for (const organization of member.group.organizations) {
      const scopeOk = member.scopeAllOrgs || scopeOrgIds.includes(organization.id);
      if (!scopeOk) continue;

      const override = overrideByMemberOrg.get(`${member.id}:${organization.id}`);
      if (override?.revokedAt) continue;

      const role = override?.roleOverride ?? member.role;
      if (Array.isArray(roles) && roles.length > 0 && !roles.includes(role)) continue;

      results.push({
        organizationId: organization.id,
        role,
        rolePack: member.rolePack ?? null,
        groupMemberId: member.id,
        groupId: member.groupId,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        organization,
      });
    }
  }

  return results;
}
