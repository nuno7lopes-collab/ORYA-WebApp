import { Prisma, type SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const OPS_FEED_EVENT_TYPES = new Set([
  "booking.created",
  "booking.cancelled",
  "booking.no_show",
  "payment.succeeded",
  "payment.failed",
  "subscription.failed",
  "ticket.order.created",
  "padel.registration.created",
  "padel.registration.expired",
  "checkin.success",
  "checkin.denied",
  "checkin.duplicate",
  "refund.created",
  "refund.succeeded",
  "chargeback.opened",
  "review.negative",
  "report.created",
  "inventory.low_stock",
]);

const CHAT_ORG_ROLES = ["OWNER", "CO_OWNER", "ADMIN", "STAFF", "TRAINER"] as const;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function maybePostOpsMessage(params: {
  organizationId: number;
  eventType: string;
  createdAt: Date;
}) {
  const orgMembers = await prisma.organizationMember.findMany({
    where: { organizationId: params.organizationId, role: { in: CHAT_ORG_ROLES as any } },
    select: { userId: true, role: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  const fallbackSender = orgMembers[0]?.userId ?? null;
  if (!fallbackSender) return;

  let conversation = await prisma.chatConversation.findFirst({
    where: { organizationId: params.organizationId, contextType: "ORG_CHANNEL", title: "Operações" },
    select: { id: true },
  });

  if (!conversation) {
    conversation = await prisma.chatConversation.create({
      data: {
        organizationId: params.organizationId,
        type: "CHANNEL",
        contextType: "ORG_CHANNEL",
        title: "Operações",
        description: "Coordenação do dia-a-dia.",
        members: {
          create: orgMembers.map((member) => ({
            userId: member.userId,
            role: member.userId === fallbackSender ? "ADMIN" : "MEMBER",
            organizationId: params.organizationId,
          })),
        },
      },
      select: { id: true },
    });
  }

  await prisma.chatConversationMessage.create({
    data: {
      conversationId: conversation.id,
      organizationId: params.organizationId,
      senderId: fallbackSender,
      body: `Evento: ${params.eventType}`,
      clientMessageId: `ops:${params.eventType}:${params.createdAt.getTime()}`,
      kind: "SYSTEM",
      createdAt: params.createdAt,
    },
  });
}

export async function consumeEventLogToOpsFeed(eventId: string) {
  const event = await prisma.eventLog.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false as const, code: "EVENT_NOT_FOUND" as const };
  if (!OPS_FEED_EVENT_TYPES.has(event.eventType)) {
    return { ok: false as const, code: "EVENT_NOT_ELIGIBLE" as const };
  }
  if ((event.sourceType && !event.sourceId) || (!event.sourceType && event.sourceId)) {
    return { ok: false as const, code: "EVENT_INCOMPLETE" as const };
  }

  try {
    await prisma.activityFeedItem.create({
      data: {
        organizationId: event.organizationId,
        eventId: event.id,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        sourceType: event.sourceType as SourceType | null,
        sourceId: event.sourceId,
        correlationId: event.correlationId,
        createdAt: event.createdAt,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: true as const, deduped: true as const };
    }
    throw err;
  }

  await maybePostOpsMessage({
    organizationId: event.organizationId,
    eventType: event.eventType,
    createdAt: event.createdAt,
  });

  return { ok: true as const, deduped: false as const };
}

export async function consumeOpsFeedBatch(params?: { limit?: number; now?: Date }) {
  const limit = params?.limit ?? 100;
  const events = await prisma.eventLog.findMany({
    where: {
      eventType: { in: Array.from(OPS_FEED_EVENT_TYPES) },
      activityItem: null,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const event of events) {
    await consumeEventLogToOpsFeed(event.id);
  }

  return { ok: true as const, processed: events.length };
}
