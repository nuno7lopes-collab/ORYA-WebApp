import { OrganizerMemberRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxLike = Prisma.TransactionClient | PrismaClient;

/**
 * Garante unicidade de OWNER numa organização:
 * - promove/cria o utilizador como OWNER
 * - despromove todos os outros OWNER para CO_OWNER
 */
export async function setSoleOwner(
  client: TxLike,
  organizerId: number,
  userId: string,
  invitedByUserId?: string | null,
) {
  await client.organizerMember.upsert({
    where: { organizerId_userId: { organizerId, userId } },
    update: { role: OrganizerMemberRole.OWNER },
    create: {
      organizerId,
      userId,
      role: OrganizerMemberRole.OWNER,
      invitedByUserId: invitedByUserId ?? undefined,
    },
  });

  await client.organizerMember.updateMany({
    where: { organizerId, role: OrganizerMemberRole.OWNER, userId: { not: userId } },
    data: { role: OrganizerMemberRole.CO_OWNER },
  });
}

/**
 * Marca o perfil como "organizer" no array de roles (idempotente).
 */
export async function ensureUserIsOrganizer(client: TxLike, userId: string) {
  const targetProfile = await client.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  if (!targetProfile) return;

  const roles = Array.isArray(targetProfile.roles) ? targetProfile.roles : [];
  if (!roles.includes("organizer")) {
    await client.profile.update({
      where: { id: userId },
      data: { roles: [...roles, "organizer"] },
    });
  }
}

/**
 * Wrapper que permite usar helper fora de transação quando necessário.
 */
export async function setSoleOwnerSafe(
  organizerId: number,
  userId: string,
  invitedByUserId?: string | null,
) {
  return setSoleOwner(prisma, organizerId, userId, invitedByUserId);
}
