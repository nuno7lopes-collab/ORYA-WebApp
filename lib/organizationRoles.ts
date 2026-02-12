import { OrganizationMemberRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureGroupMemberForOrg, setGroupMemberRoleForOrg } from "@/lib/organizationGroupAccess";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

type TxLike = Prisma.TransactionClient | PrismaClient;

/**
 * Garante unicidade de OWNER numa organização:
 * - promove/cria o utilizador como OWNER
 * - despromove todos os outros OWNER para CO_OWNER
 */
export async function setSoleOwner(
  client: TxLike,
  organizationId: number,
  userId: string,
  invitedByUserId?: string | null,
) {
  await ensureGroupMemberForOrg({
    organizationId,
    userId,
    role: OrganizationMemberRole.OWNER,
    rolePack: null,
    client,
  });

  const previousOwners = await listEffectiveOrganizationMembers({
    organizationId,
    client,
    roles: [OrganizationMemberRole.OWNER],
  });
  for (const owner of previousOwners) {
    if (owner.userId === userId) continue;
    await setGroupMemberRoleForOrg({
      organizationId,
      userId: owner.userId,
      role: OrganizationMemberRole.CO_OWNER,
      rolePack: null,
      client,
    });
  }
}

/**
 * Marca o perfil como "organization" no array de roles (idempotente).
 */
export async function ensureUserIsOrganization(client: TxLike, userId: string) {
  const targetProfile = await client.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  if (!targetProfile) return;

  const roles = Array.isArray(targetProfile.roles) ? targetProfile.roles : [];
  if (!roles.includes("organization")) {
    await client.profile.update({
      where: { id: userId },
      data: { roles: [...roles, "organization"] },
    });
  }
}

/**
 * Wrapper que permite usar helper fora de transação quando necessário.
 */
export async function setSoleOwnerSafe(
  organizationId: number,
  userId: string,
  invitedByUserId?: string | null,
) {
  return setSoleOwner(prisma, organizationId, userId, invitedByUserId);
}
