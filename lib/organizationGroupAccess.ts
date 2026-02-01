import { prisma } from "@/lib/prisma";
import type { OrganizationMemberRole, OrganizationRolePack, Prisma } from "@prisma/client";

export type GroupMemberAccess = {
  memberId: string;
  groupId: number;
  role: OrganizationMemberRole;
  rolePack: OrganizationRolePack | null;
};

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

async function findGroupMemberByUser(params: {
  db: PrismaClientLike;
  groupId: number;
  userId: string;
  select: Prisma.OrganizationGroupMemberSelect;
}) {
  const { db, groupId, userId, select } = params;
  return db.organizationGroupMember.findFirst({
    where: { groupId, userId },
    select,
  });
}

export async function resolveGroupMemberForOrg(params: {
  organizationId: number;
  userId: string;
  client?: Prisma.TransactionClient;
}): Promise<GroupMemberAccess | null> {
  const { organizationId, userId, client } = params;
  if (!organizationId || !userId) return null;
  const db = client ?? prisma;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { groupId: true },
  });
  if (!org?.groupId) return null;

  const member = await findGroupMemberByUser({
    db,
    groupId: org.groupId,
    userId,
    select: {
      id: true,
      role: true,
      rolePack: true,
      scopeAllOrgs: true,
      scopeOrgIds: true,
    },
  });
  if (!member) return null;

  const scopeOk = member.scopeAllOrgs || (member.scopeOrgIds ?? []).includes(organizationId);
  if (!scopeOk) return null;

  const override = await db.organizationGroupMemberOrganizationOverride.findFirst({
    where: { groupMemberId: member.id, organizationId },
    select: { roleOverride: true, revokedAt: true },
  });
  if (override?.revokedAt) return null;

  return {
    memberId: member.id,
    groupId: org.groupId,
    role: override?.roleOverride ?? member.role,
    rolePack: member.rolePack ?? null,
  };
}

export async function ensureGroupMemberForOrg(params: {
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole;
  rolePack?: OrganizationRolePack | null;
  scopeAllOrgs?: boolean;
  client?: Prisma.TransactionClient;
}) {
  const { organizationId, userId, role, rolePack, scopeAllOrgs = false, client } = params;
  const db = client ?? prisma;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { groupId: true },
  });
  if (!org?.groupId) {
    throw new Error("ORG_GROUP_NOT_FOUND");
  }

  const existing = await findGroupMemberByUser({
    db,
    groupId: org.groupId,
    userId,
    select: { id: true, scopeAllOrgs: true, scopeOrgIds: true },
  });

  const scopeOrgIds = existing?.scopeAllOrgs
    ? []
    : Array.from(new Set([...(existing?.scopeOrgIds ?? []), organizationId]));

  if (existing?.id) {
    return db.organizationGroupMember.update({
      where: { id: existing.id },
      data: {
        role,
        rolePack: rolePack ?? undefined,
        scopeAllOrgs: existing.scopeAllOrgs ?? scopeAllOrgs,
        scopeOrgIds,
      },
    });
  }

  return db.organizationGroupMember.create({
    data: {
      groupId: org.groupId,
      userId,
      role,
      rolePack: rolePack ?? undefined,
      scopeAllOrgs,
      scopeOrgIds: [organizationId],
    },
  });
}

export async function revokeGroupMemberForOrg(params: {
  organizationId: number;
  userId: string;
  client?: Prisma.TransactionClient;
}) {
  const { organizationId, userId, client } = params;
  const db = client ?? prisma;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { groupId: true },
  });
  if (!org?.groupId) return;

  const targetGroup = await findGroupMemberByUser({
    db,
    groupId: org.groupId,
    userId,
    select: { id: true, scopeAllOrgs: true, scopeOrgIds: true },
  });
  if (!targetGroup) return;

  if (targetGroup.scopeAllOrgs) {
    const revokedAt = new Date();
    const updated = await db.organizationGroupMemberOrganizationOverride.updateMany({
      where: { groupMemberId: targetGroup.id, organizationId },
      data: { revokedAt },
    });
    if (updated.count === 0) {
      await db.organizationGroupMemberOrganizationOverride.createMany({
        data: [
          {
            groupMemberId: targetGroup.id,
            organizationId,
            revokedAt,
          },
        ],
        skipDuplicates: true,
      });
    }
    return;
  }

  const nextScope = (targetGroup.scopeOrgIds ?? []).filter((id) => id !== organizationId);
  if (nextScope.length === 0) {
    await db.organizationGroupMemberOrganizationOverride.deleteMany({
      where: { groupMemberId: targetGroup.id },
    });
    await db.organizationGroupMember.delete({ where: { id: targetGroup.id } });
    return;
  }

  await db.organizationGroupMember.update({
    where: { id: targetGroup.id },
    data: { scopeOrgIds: nextScope },
  });
  await db.organizationGroupMemberOrganizationOverride.deleteMany({
    where: { groupMemberId: targetGroup.id, organizationId },
  });
}

export async function ensureGroupMemberRole(params: {
  organizationId: number;
  userId: string;
  allowedRoles?: OrganizationMemberRole[];
  client?: Prisma.TransactionClient;
}) {
  const { organizationId, userId, allowedRoles, client } = params;
  const membership = await resolveGroupMemberForOrg({ organizationId, userId, client });
  if (!membership) {
    return { ok: false as const };
  }
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { ok: false as const };
  }
  return { ok: true as const, membership };
}
