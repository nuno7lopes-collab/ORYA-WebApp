import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";

// Claim automático: quando email é verificado, transfere ownership para userId.
export async function claimIdentity(email: string, userId: string, opts?: { requireVerified?: boolean }) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) return;
  const client: any = prisma as any;
  if (!client.emailIdentity || typeof client.emailIdentity.findUnique !== "function") return;

  const identity = await client.emailIdentity.findUnique({
    where: { emailNormalized },
    select: { id: true, userId: true, emailVerifiedAt: true },
  });
  if (!identity) return;

  // já está claimed
  if (identity.userId === userId) return;

  if (opts?.requireVerified && !identity.emailVerifiedAt) {
    // Sem email verificado, não fazemos claim
    return;
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).emailIdentity.update({
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
