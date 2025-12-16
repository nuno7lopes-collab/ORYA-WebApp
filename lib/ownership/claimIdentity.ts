import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";

// Claim automático: quando email é verificado, transfere ownership para userId.
export async function claimIdentity(email: string, userId: string) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) return;

  const identity = await prisma.emailIdentity.findUnique({
    where: { emailNormalized },
    select: { id: true, userId: true, emailVerifiedAt: true },
  });
  if (!identity) return;

  // já está claimed
  if (identity.userId === userId) return;

  await prisma.$transaction(async (tx) => {
    await tx.emailIdentity.update({
      where: { emailNormalized },
      data: { userId, emailVerifiedAt: identity.emailVerifiedAt ?? new Date() },
    });

    // tickets
    await tx.ticket.updateMany({
      where: { ownerIdentityId: identity.id },
      data: { ownerUserId: userId, ownerIdentityId: null },
    });
    // sale_summaries
    await tx.saleSummary.updateMany({
      where: { ownerIdentityId: identity.id },
      data: { ownerUserId: userId, ownerIdentityId: null },
    });
    // tournament_entries
    await tx.tournamentEntry.updateMany({
      where: { ownerIdentityId: identity.id },
      data: { ownerUserId: userId, ownerIdentityId: null },
    });
  });
}
