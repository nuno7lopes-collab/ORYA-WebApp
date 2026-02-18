import type { Prisma, PrismaClient } from "@prisma/client";
import { OrganizationMemberRole } from "@prisma/client";
import { setSoleOwner } from "@/lib/organizationRoles";

type TxLike = Prisma.TransactionClient | PrismaClient;

const GOVERNANCE_ALLOWED_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

export async function enforceGroupGovernanceInvariants(tx: TxLike, groupId: number) {
  const group = await tx.organizationGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerUserId: true,
      organizations: { select: { id: true }, orderBy: { id: "asc" } },
    },
  });
  if (!group) {
    throw new Error("GROUP_NOT_FOUND");
  }

  const ownerUserId = group.ownerUserId;

  // Ensure the group owner is a governance member with global scope.
  const ownerMember = await tx.organizationGroupMember.findFirst({
    where: { groupId, userId: ownerUserId },
    select: { id: true },
  });
  if (ownerMember?.id) {
    await tx.organizationGroupMember.update({
      where: { id: ownerMember.id },
      data: {
        isGovernance: true,
        role: OrganizationMemberRole.OWNER,
        rolePack: null,
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });
  } else {
    await tx.organizationGroupMember.create({
      data: {
        groupId,
        userId: ownerUserId,
        isGovernance: true,
        role: OrganizationMemberRole.OWNER,
        rolePack: null,
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });
  }

  const governanceMembers = await tx.organizationGroupMember.findMany({
    where: { groupId, isGovernance: true },
    select: { id: true, userId: true, role: true },
    orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
  });

  // Normalize governance members: no overrides, global scope, single OWNER (the group owner).
  for (const member of governanceMembers) {
    const nextRole =
      member.userId === ownerUserId
        ? OrganizationMemberRole.OWNER
        : member.role === OrganizationMemberRole.OWNER
          ? OrganizationMemberRole.CO_OWNER
          : GOVERNANCE_ALLOWED_ROLES.has(member.role)
            ? member.role
            : OrganizationMemberRole.ADMIN;
    await tx.organizationGroupMember.update({
      where: { id: member.id },
      data: {
        role: nextRole,
        rolePack: null,
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });
  }

  if (governanceMembers.length > 0) {
    await tx.organizationGroupMemberOrganizationOverride.deleteMany({
      where: { groupMemberId: { in: governanceMembers.map((m) => m.id) } },
    });
  }

  // Ensure the group owner is the sole OWNER in every organization of the group.
  for (const organization of group.organizations) {
    await setSoleOwner(tx, organization.id, ownerUserId, ownerUserId);
  }
}
