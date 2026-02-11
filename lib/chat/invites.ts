import { prisma } from "@/lib/prisma";

const INVITE_WINDOW_HOURS = 24;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function computeInviteExpiry(endsAt?: Date | null, startsAt?: Date | null) {
  const base = endsAt ?? startsAt ?? null;
  if (!base) return null;
  return addHours(base, INVITE_WINDOW_HOURS);
}

function normalizeStatus(status: string) {
  const normalized = status.toUpperCase();
  if (["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "REVOKED", "AUTO_ACCEPTED"].includes(normalized)) {
    return normalized as
      | "PENDING"
      | "ACCEPTED"
      | "DECLINED"
      | "CANCELLED"
      | "EXPIRED"
      | "REVOKED"
      | "AUTO_ACCEPTED";
  }
  return "PENDING" as const;
}

export async function ensureEventChatInvite(input: {
  eventId: number;
  entitlementId: string;
  ownerUserId?: string | null;
  endsAt?: Date | null;
  startsAt?: Date | null;
  now?: Date;
}) {
  const ownerUserId = input.ownerUserId ?? null;
  const entitlementId = input.entitlementId;
  if (!entitlementId) {
    return { ok: false as const, reason: "NO_ENTITLEMENT" };
  }

  let startsAt = input.startsAt ?? null;
  let endsAt = input.endsAt ?? null;
  if (!startsAt && !endsAt) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { startsAt: true, endsAt: true, organizationId: true, isDeleted: true },
    });
    if (!event || event.isDeleted || !event.organizationId) {
      return { ok: false as const, reason: "EVENT_NOT_FOUND" };
    }
    startsAt = event.startsAt;
    endsAt = event.endsAt;
  }

  const expiresAt = computeInviteExpiry(endsAt, startsAt);
  if (!expiresAt) {
    return { ok: false as const, reason: "INVALID_EVENT" };
  }

  const now = input.now ?? new Date();
  if (expiresAt <= now) {
    return { ok: false as const, reason: "EXPIRED" };
  }

  const conversation = await prisma.chatConversation.findFirst({
    where: {
      contextType: "EVENT",
      contextId: String(input.eventId),
    },
    select: { id: true },
  });

  const existing = await prisma.chatAccessGrant.findFirst({
    where: {
      kind: "EVENT_INVITE",
      eventId: input.eventId,
      entitlementId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      threadId: true,
    },
  });

  if (existing) {
    const currentStatus = normalizeStatus(existing.status);
    const nextStatus = currentStatus === "EXPIRED" && expiresAt > now ? "PENDING" : currentStatus;

    await prisma.chatAccessGrant.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        targetUserId: ownerUserId ?? undefined,
        expiresAt,
        conversationId: conversation?.id ?? undefined,
        threadId: existing.threadId ?? conversation?.id ?? undefined,
        updatedAt: now,
      },
    });

    return {
      ok: true as const,
      inviteId: existing.id,
      threadId: existing.threadId ?? conversation?.id ?? null,
      expiresAt,
      created: false as const,
      status: nextStatus,
    };
  }

  const grant = await prisma.chatAccessGrant.create({
    data: {
      kind: "EVENT_INVITE",
      status: "PENDING",
      contextType: "EVENT",
      contextId: String(input.eventId),
      eventId: input.eventId,
      entitlementId,
      targetUserId: ownerUserId,
      conversationId: conversation?.id ?? null,
      threadId: conversation?.id ?? null,
      expiresAt,
      metadata: { canonical: true },
    },
    select: { id: true, threadId: true },
  });

  return {
    ok: true as const,
    inviteId: grant.id,
    threadId: grant.threadId ?? conversation?.id ?? null,
    expiresAt,
    created: true as const,
    status: "PENDING" as const,
  };
}
