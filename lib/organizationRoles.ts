import { OrganizationMemberRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  await client.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { role: OrganizationMemberRole.OWNER },
    create: {
      organizationId,
      userId,
      role: OrganizationMemberRole.OWNER,
      invitedByUserId: invitedByUserId ?? undefined,
    },
  });

  await client.organizationMember.updateMany({
    where: { organizationId, role: OrganizationMemberRole.OWNER, userId: { not: userId } },
    data: { role: OrganizationMemberRole.CO_OWNER },
  });
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
