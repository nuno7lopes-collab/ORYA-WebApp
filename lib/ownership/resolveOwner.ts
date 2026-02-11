import { normalizeEmail } from "@/lib/utils/email";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";

export type OwnerInput = {
  sessionUserId?: string | null;
  guestEmail?: string | null;
};

export async function resolveOwner(input: OwnerInput) {
  const sessionUserId = input.sessionUserId?.trim() || null;
  const guestEmail = normalizeEmail(input.guestEmail);

  if (sessionUserId) {
    const identity = await resolveIdentityForUser({ userId: sessionUserId });
    return {
      ownerUserId: sessionUserId,
      ownerIdentityId: identity.id,
      emailNormalized: identity.emailNormalized,
    };
  }

  if (!guestEmail) {
    return { ownerUserId: null, ownerIdentityId: null, emailNormalized: null };
  }

  const identity = await ensureEmailIdentity({ email: guestEmail });
  return {
    ownerUserId: identity.emailVerifiedAt ? identity.userId : null,
    ownerIdentityId: identity.id,
    emailNormalized: guestEmail,
  };
}
