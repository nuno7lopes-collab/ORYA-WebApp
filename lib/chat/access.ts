import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import { CheckinResultCode, Prisma } from "@prisma/client";

export const CHAT_ORG_ROLES = [
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
  "TRAINER",
] as const;

export type ChatAccessCutoffs = {
  participantUntil: Date;
  orgUntil: Date;
  adminUntil: Date;
};

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function computeChatAccessCutoffs(endsAt?: Date | null, startsAt?: Date | null): ChatAccessCutoffs | null {
  const base = endsAt ?? startsAt ?? null;
  if (!base) return null;
  return {
    participantUntil: addHours(base, 24),
    orgUntil: addDays(base, 3),
    adminUntil: addDays(base, 7),
  };
}

export async function getUserIdentityIds(userId: string) {
  const identities = await prisma.emailIdentity.findMany({
    where: { userId },
    select: { id: true },
  });
  return identities.map((identity) => identity.id);
}

export function buildEntitlementOwnerClauses(input: {
  userId: string;
  identityIds?: string[];
  email?: string | null;
}): Prisma.EntitlementWhereInput[] {
  const identityIds = input.identityIds ?? [];
  const emailNormalized = normalizeEmail(input.email ?? null);
  const ownerClauses: Prisma.EntitlementWhereInput[] = [{ ownerUserId: input.userId }];
  if (identityIds.length) {
    ownerClauses.push({ ownerIdentityId: { in: identityIds } });
  }
  if (emailNormalized) {
    ownerClauses.push({ ownerKey: `email:${emailNormalized}` });
  }
  return ownerClauses;
}

export async function getConsumedEntitlementForEvent(input: {
  userId: string;
  eventId: number;
  identityIds?: string[];
  email?: string | null;
}) {
  const ownerClauses = buildEntitlementOwnerClauses({
    userId: input.userId,
    identityIds: input.identityIds,
    email: input.email,
  });

  return prisma.entitlement.findFirst({
    where: {
      eventId: input.eventId,
      status: "ACTIVE",
      OR: ownerClauses,
      checkins: {
        some: {
          resultCode: { in: [CheckinResultCode.OK, CheckinResultCode.ALREADY_USED] },
        },
      },
    },
    select: {
      id: true,
      ownerUserId: true,
      ownerIdentityId: true,
      ownerKey: true,
      status: true,
    },
  });
}

export async function hasConsumedEntitlementForEvent(input: {
  userId: string;
  eventId: number;
  identityIds?: string[];
  email?: string | null;
}) {
  const entitlement = await getConsumedEntitlementForEvent(input);
  return Boolean(entitlement);
}
