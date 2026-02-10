export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ChatConversationContextType, Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";

const B2C_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.USER_DM,
  ChatConversationContextType.USER_GROUP,
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.BOOKING,
  ChatConversationContextType.SERVICE,
];

type ConversationMember = {
  userId: string;
  displayAs: "ORGANIZATION" | "PROFESSIONAL";
  hiddenFromCustomer: boolean;
  user: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
};

function resolveUserLabel(user: ConversationMember["user"]) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Utilizador");
}

function buildConversationDisplay(params: {
  conversation: {
    id: string;
    type: string;
    title: string | null;
    contextType: string;
    contextId: string | null;
    customerId: string | null;
    professionalId: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    lastMessage: {
      id: string;
      body: string | null;
      createdAt: Date;
      senderId: string | null;
    } | null;
    organization: {
      id: number;
      publicName: string | null;
      businessName: string | null;
      username: string | null;
      brandingAvatarUrl: string | null;
    } | null;
    members: ConversationMember[];
  };
  viewerId: string;
}) {
  const { conversation, viewerId } = params;
  const members = conversation.members;
  const viewerIsCustomer = conversation.customerId && conversation.customerId === viewerId;

  if (conversation.contextType === "USER_DM") {
    const other = members.find((member) => member.userId !== viewerId);
    const title = other ? resolveUserLabel(other.user) : "Conversa";
    return {
      title,
      subtitle: null as string | null,
      imageUrl: other?.user.avatarUrl ?? null,
    };
  }

  if (conversation.contextType === "USER_GROUP") {
    return {
      title: conversation.title || "Grupo",
      subtitle: null as string | null,
      imageUrl: null as string | null,
    };
  }

  const organizationName =
    conversation.organization?.publicName || conversation.organization?.businessName || "Organização";

  const professionalMember =
    members.find((member) => member.userId === conversation.professionalId) ||
    members.find((member) => member.displayAs === "PROFESSIONAL");
  const customerMember = members.find((member) => member.userId === conversation.customerId);

  if (viewerIsCustomer) {
    const title = professionalMember ? resolveUserLabel(professionalMember.user) : organizationName;
    return {
      title,
      subtitle: organizationName,
      imageUrl:
        professionalMember?.user.avatarUrl ?? conversation.organization?.brandingAvatarUrl ?? null,
    };
  }

  const title = customerMember ? resolveUserLabel(customerMember.user) : organizationName;
  return {
    title,
    subtitle: organizationName,
    imageUrl: customerMember?.user.avatarUrl ?? conversation.organization?.brandingAvatarUrl ?? null,
  };
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const identityIds = await getUserIdentityIds(user.id);
    const ownerClauses = buildEntitlementOwnerClauses({
      userId: user.id,
      identityIds,
      email: user.email ?? null,
    });

    const acceptedInvites = await prisma.chatEventInvite.findMany({
      where: {
        status: "ACCEPTED",
        userId: user.id,
        entitlement: {
          status: "ACTIVE",
          OR: ownerClauses,
          checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
        },
      },
      select: { eventId: true },
    });

    const eventIds = Array.from(new Set(acceptedInvites.map((invite) => invite.eventId).filter(Boolean))) as number[];

    if (eventIds.length) {
      for (const eventId of eventIds) {
        await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_event_thread(${eventId})`);
      }
    }

    const threads = eventIds.length
      ? await prisma.chatThread.findMany({
          where: { entityType: "EVENT", entityId: { in: eventIds } },
          select: {
            id: true,
            status: true,
            entityId: true,
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { id: true, body: true, createdAt: true, kind: true, deletedAt: true },
            },
          },
        })
      : [];

    const threadIds = threads.map((thread) => thread.id);
    const threadMutes =
      threadIds.length > 0
        ? await prisma.chatMember.findMany({
            where: { threadId: { in: threadIds }, userId: user.id },
            select: { threadId: true, mutedUntil: true },
          })
        : [];
    const threadMuteMap = new Map(
      threadMutes.map((row) => [row.threadId, row.mutedUntil ? row.mutedUntil.toISOString() : null]),
    );

    const events = eventIds.length
      ? await prisma.event.findMany({
          where: { id: { in: eventIds }, isDeleted: false },
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            endsAt: true,
            coverImageUrl: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
            status: true,
          },
        })
      : [];
    const eventMap = new Map(events.map((event) => [event.id, event]));

    const eventItems = threads
      .map((thread) => {
        const event = eventMap.get(thread.entityId);
        if (!event) return null;
        const lastMessage = thread.messages[0] ?? null;
        const lastBody = lastMessage?.deletedAt ? null : lastMessage?.body;
        return {
          id: `event:${thread.id}`,
          kind: "EVENT" as const,
          threadId: thread.id,
          status: thread.status,
          title: event.title,
          subtitle: event.addressRef?.formattedAddress ?? null,
          imageUrl: event.coverImageUrl ?? null,
          lastMessageAt: lastMessage?.createdAt?.toISOString() ?? event.startsAt?.toISOString() ?? null,
          lastMessage: lastMessage ? { id: lastMessage.id, body: lastBody, createdAt: lastMessage.createdAt.toISOString() } : null,
          unreadCount: 0,
          mutedUntil: threadMuteMap.get(thread.id) ?? null,
          event: {
            id: event.id,
            slug: event.slug,
            startsAt: event.startsAt ? event.startsAt.toISOString() : null,
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          },
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const memberships = await prisma.chatConversationMember.findMany({
      where: {
        userId: user.id,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      include: {
        lastReadMessage: { select: { id: true, createdAt: true } },
        conversation: {
          select: {
            id: true,
            type: true,
            title: true,
            contextType: true,
            contextId: true,
            customerId: true,
            professionalId: true,
            createdAt: true,
            lastMessageAt: true,
            lastMessage: {
              select: { id: true, body: true, createdAt: true, senderId: true },
            },
            organization: {
              select: { id: true, publicName: true, businessName: true, username: true, brandingAvatarUrl: true },
            },
            members: {
              select: {
                userId: true,
                displayAs: true,
                hiddenFromCustomer: true,
                user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: "desc" } },
    });

    const conversationIds = memberships.map((entry) => entry.conversation.id);
    const unreadRows =
      conversationIds.length > 0
        ? await prisma.$queryRaw<{ conversation_id: string; unread_count: number }[]>(Prisma.sql`
            WITH member_reads AS (
              SELECT
                m.conversation_id,
                m.last_read_message_id,
                rm.created_at AS last_read_at
              FROM app_v3.chat_conversation_members m
              LEFT JOIN app_v3.chat_conversation_messages rm
                ON rm.id = m.last_read_message_id
              WHERE m.user_id = ${user.id}
                AND m.conversation_id IN (${Prisma.join(conversationIds)})
            )
            SELECT
              mr.conversation_id,
              COUNT(msg.id)::int AS unread_count
            FROM member_reads mr
            LEFT JOIN app_v3.chat_conversation_messages msg
              ON msg.conversation_id = mr.conversation_id
              AND msg.deleted_at IS NULL
              AND msg.reply_to_id IS NULL
              AND (
                mr.last_read_message_id IS NULL
                OR msg.created_at > mr.last_read_at
                OR (msg.created_at = mr.last_read_at AND msg.id > mr.last_read_message_id)
              )
            GROUP BY mr.conversation_id
          `)
        : [];
    const unreadCountMap = new Map(
      unreadRows.map((row) => [row.conversation_id, Number(row.unread_count) || 0]),
    );

    const conversationItems = memberships.map((entry) => {
      const conv = entry.conversation;
      const display = buildConversationDisplay({ conversation: conv, viewerId: user.id });
      return {
        id: `conversation:${conv.id}`,
        kind: "CONVERSATION" as const,
        conversationId: conv.id,
        contextType: conv.contextType,
        title: display.title,
        subtitle: display.subtitle,
        imageUrl: display.imageUrl,
        lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : conv.createdAt.toISOString(),
        lastMessage: conv.lastMessage
          ? {
              id: conv.lastMessage.id,
              body: conv.lastMessage.body,
              createdAt: conv.lastMessage.createdAt.toISOString(),
            }
          : null,
        unreadCount: unreadCountMap.get(conv.id) ?? 0,
        mutedUntil: entry.mutedUntil ? entry.mutedUntil.toISOString() : null,
      };
    });

    const items = [...eventItems, ...conversationItems].sort((a: any, b: any) => {
      const aTime = a.lastMessageAt ?? "";
      const bTime = b.lastMessageAt ?? "";
      return bTime.localeCompare(aTime);
    });

    return jsonWrap({ items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/inbox] error", err);
    return jsonWrap({ error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
