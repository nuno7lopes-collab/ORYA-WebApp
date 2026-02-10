import { Prisma } from "@prisma/client";
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

  await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_event_thread(${input.eventId})`);
  const thread = await prisma.chatThread.findFirst({
    where: { entityType: "EVENT", entityId: input.eventId },
    select: { id: true },
  });
  if (!thread) {
    return { ok: false as const, reason: "THREAD_NOT_FOUND" };
  }

  const existing = await prisma.chatEventInvite.findFirst({
    where: { eventId: input.eventId, entitlementId },
    select: { id: true, status: true, userId: true },
  });

  if (existing) {
    const nextStatus =
      existing.status === "EXPIRED" && expiresAt > now ? "PENDING" : existing.status;
    await prisma.chatEventInvite.update({
      where: { id: existing.id },
      data: {
        expiresAt,
        status: nextStatus,
        updatedAt: now,
        userId: existing.userId ?? ownerUserId ?? undefined,
      },
    });
    return {
      ok: true as const,
      inviteId: existing.id,
      threadId: thread.id,
      expiresAt,
      created: false as const,
      status: nextStatus,
    };
  }

  const invite = await prisma.chatEventInvite.create({
    data: {
      threadId: thread.id,
      eventId: input.eventId,
      entitlementId,
      userId: ownerUserId,
      expiresAt,
      status: "PENDING",
    },
    select: { id: true },
  });

  return {
    ok: true as const,
    inviteId: invite.id,
    threadId: thread.id,
    expiresAt,
    created: true as const,
    status: "PENDING" as const,
  };
}
