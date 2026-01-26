import { EntitlementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEntitlementEffectiveStatus } from "@/lib/entitlements/status";

// Access decisions are Entitlement-first; ticket/booking state is operational, not proof.
export type EntitlementGateResult = {
  ok: boolean;
  reason?: "ENTITLEMENT_REQUIRED" | "ENTITLEMENT_NOT_ACTIVE";
  entitlementId?: string;
};

export async function hasActiveEntitlementForEvent(input: {
  eventId: number;
  userId: string;
  type?: EntitlementType;
}) {
  const ownerKey = `user:${input.userId}`;
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      eventId: input.eventId,
      type: input.type ?? EntitlementType.EVENT_TICKET,
      ownerKey,
    },
    select: { status: true, checkins: { select: { resultCode: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!entitlement) return false;
  const effective = getEntitlementEffectiveStatus({
    status: entitlement.status,
    checkins: entitlement.checkins,
  });
  return effective === "ACTIVE" || effective === "SUSPENDED";
}

export async function requireActiveEntitlementForTicket(input: {
  ticketId: string;
  userId: string;
  eventId?: number | null;
}): Promise<EntitlementGateResult> {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      ticketId: input.ticketId,
      ownerUserId: input.userId,
      ...(input.eventId ? { eventId: input.eventId } : {}),
    },
    select: { id: true, status: true },
  });

  if (!entitlement) return { ok: false, reason: "ENTITLEMENT_REQUIRED" };
  const effective = getEntitlementEffectiveStatus({ status: entitlement.status });
  if (effective !== "ACTIVE") return { ok: false, reason: "ENTITLEMENT_NOT_ACTIVE" };
  return { ok: true, entitlementId: entitlement.id };
}
