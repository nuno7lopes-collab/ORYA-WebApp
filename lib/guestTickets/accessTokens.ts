import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueGuestTicketAccessToken(input: {
  purchaseId: string;
  eventId: number;
  guestEmail: string;
  expiresAt: Date;
}) {
  const normalizedEmail = normalizeEmail(input.guestEmail) ?? input.guestEmail.trim().toLowerCase();
  const token = crypto.randomUUID();
  const tokenHash = hashToken(token);

  await prisma.guestTicketAccessToken.upsert({
    where: {
      purchaseId_guestEmail: {
        purchaseId: input.purchaseId,
        guestEmail: normalizedEmail,
      },
    },
    update: {
      tokenHash,
      expiresAt: input.expiresAt,
      eventId: input.eventId,
      updatedAt: new Date(),
    },
    create: {
      purchaseId: input.purchaseId,
      eventId: input.eventId,
      guestEmail: normalizedEmail,
      tokenHash,
      expiresAt: input.expiresAt,
    },
  });

  return token;
}

export function isGuestTicketAccessTokenExpired(expiresAt: Date | null, now = new Date()) {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}
