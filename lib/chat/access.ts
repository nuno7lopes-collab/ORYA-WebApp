import { prisma } from "@/lib/prisma";
import { CheckinResultCode, Prisma } from "@prisma/client";
import { getUserIdentityIds as getIdentityIds } from "@/lib/ownership/identity";

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
  return getIdentityIds(userId);
}

export function buildEntitlementOwnerClauses(input: {
  userId: string;
  identityIds?: string[];
  email?: string | null;
}): Prisma.EntitlementWhereInput[] {
  const identityIds = input.identityIds ?? [];
  if (!identityIds.length) return [];
  return [{ ownerIdentityId: { in: identityIds } }];
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
  if (ownerClauses.length === 0) return null;

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
