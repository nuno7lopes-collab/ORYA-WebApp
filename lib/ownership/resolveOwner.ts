import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";

export type OwnerInput = {
  sessionUserId?: string | null;
  guestEmail?: string | null;
};

export async function resolveOwner(input: OwnerInput) {
  const sessionUserId = input.sessionUserId?.trim() || null;
  const guestEmail = normalizeEmail(input.guestEmail);
  const client: any = prisma as any;
  const hasEmailIdentity =
    client.emailIdentity &&
    typeof client.emailIdentity.findUnique === "function" &&
    typeof client.emailIdentity.create === "function";

  if (sessionUserId) {
    return { ownerUserId: sessionUserId, ownerIdentityId: null, emailNormalized: guestEmail };
  }

  if (!guestEmail) {
    return { ownerUserId: null, ownerIdentityId: null, emailNormalized: null };
  }

  // Procura/gera EmailIdentity
  if (!hasEmailIdentity) {
    return { ownerUserId: null, ownerIdentityId: null, emailNormalized: guestEmail };
  }

  let identity = await client.emailIdentity.findUnique({
    where: { emailNormalized: guestEmail },
    select: { id: true, userId: true, emailVerifiedAt: true },
  });

  if (!identity) {
    identity = await client.emailIdentity.create({
      data: { emailNormalized: guestEmail },
      select: { id: true, userId: true, emailVerifiedAt: true },
    });
  }

  // Claim automático se já tiver user e verificado
  if (identity.userId && identity.emailVerifiedAt) {
    return { ownerUserId: identity.userId, ownerIdentityId: null, emailNormalized: guestEmail };
  }

  return { ownerUserId: null, ownerIdentityId: identity.id, emailNormalized: guestEmail };
}
