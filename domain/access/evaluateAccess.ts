import { prisma } from "@/lib/prisma";
import { getLatestPolicyForEvent } from "@/lib/checkin/accessPolicy";
import { getEntitlementEffectiveStatus } from "@/lib/entitlements/status";

export type AccessIntent = "INVITE_TOKEN" | "VIEW";

export type AccessInput = {
  eventId: number;
  userId?: string | null;
  intent?: AccessIntent;
  now?: Date;
};

export type AccessDecision = {
  allowed: boolean;
  reasonCode: string;
};

export async function evaluateEventAccess(input: AccessInput): Promise<AccessDecision> {
  const { eventId, userId, intent = "VIEW" } = input;
  const policy = await getLatestPolicyForEvent(eventId, prisma);
  if (!policy) {
    return { allowed: true, reasonCode: "NO_POLICY" };
  }

  if (intent === "INVITE_TOKEN") {
    if (!policy.inviteTokenAllowed) {
      return { allowed: false, reasonCode: "INVITE_TOKEN_NOT_ALLOWED" };
    }
    if (policy.inviteIdentityMatch === "USERNAME") {
      return { allowed: false, reasonCode: "INVITE_TOKEN_REQUIRES_EMAIL" };
    }
    if (policy.inviteTokenTtlSeconds == null) {
      return { allowed: false, reasonCode: "INVITE_TOKEN_TTL_REQUIRED" };
    }
  }

  if (policy.requiresEntitlementForEntry) {
    if (!userId) {
      return { allowed: false, reasonCode: "ENTITLEMENT_REQUIRED" };
    }
    const entitlement = await prisma.entitlement.findFirst({
      where: { eventId, ownerUserId: userId },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    if (!entitlement) {
      return { allowed: false, reasonCode: "ENTITLEMENT_REQUIRED" };
    }
    const effective = getEntitlementEffectiveStatus({ status: entitlement.status });
    if (effective !== "ACTIVE") {
      return { allowed: false, reasonCode: "ENTITLEMENT_NOT_ACTIVE" };
    }
  }

  if (policy.mode === "INVITE_ONLY" && !userId) {
    return { allowed: false, reasonCode: "INVITE_ONLY" };
  }

  return { allowed: true, reasonCode: "ALLOWED" };
}
