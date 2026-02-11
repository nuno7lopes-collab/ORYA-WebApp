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

type EventRow = {
  id: number;
  slug: string | null;
  title: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  coverImageUrl: string | null;
  addressId: string | null;
  addressRef: { formattedAddress: string | null; canonical: unknown } | null;
  status: string;
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

function resolveEventStatus(params: {
  startsAt: Date | null;
  endsAt: Date | null;
  openAt: Date | null;
  readOnlyAt: Date | null;
  closeAt: Date | null;
}) {
  const now = Date.now();
  const openAt = params.openAt?.getTime() ?? params.startsAt?.getTime() ?? null;
  const readOnlyAt =
    params.readOnlyAt?.getTime() ??
    (params.endsAt ? params.endsAt.getTime() + 24 * 60 * 60 * 1000 : null);
  const closeAt = params.closeAt?.getTime() ?? readOnlyAt;

  if (openAt !== null && now < openAt) return "ANNOUNCEMENTS";
  if (readOnlyAt !== null && now >= readOnlyAt) return "READ_ONLY";
  if (closeAt !== null && now > closeAt) return "READ_ONLY";
  return "OPEN";
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

    const membershipsPromise = prisma.chatConversationMember.findMany({
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

    const entitlementIds = ownerClauses.length
      ? (
          await prisma.entitlement.findMany({
            where: {
              status: "ACTIVE",
              OR: ownerClauses,
              checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
            },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];

    const grants = await prisma.chatAccessGrant.findMany({
      where: {
        kind: "EVENT_INVITE",
        status: { in: ["PENDING", "ACCEPTED", "AUTO_ACCEPTED"] },
        OR: [
          { targetUserId: user.id },
          entitlementIds.length ? { entitlementId: { in: entitlementIds } } : undefined,
        ].filter(Boolean) as Prisma.ChatAccessGrantWhereInput[],
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        eventId: true,
        status: true,
        threadId: true,
        conversationId: true,
        expiresAt: true,
      },
    });

    const grantByEvent = new Map<number, (typeof grants)[number]>();
    for (const grant of grants) {
      if (!grant.eventId) continue;
      if (!grantByEvent.has(grant.eventId)) {
        grantByEvent.set(grant.eventId, grant);
      }
    }

    const eventIds = Array.from(grantByEvent.keys());

    const eventConversations = eventIds.length
      ? await prisma.chatConversation.findMany({
          where: {
            OR: [
              { contextType: "EVENT", contextId: { in: eventIds.map((id) => String(id)) } },
              {
                id: {
                  in: grants
                    .map((grant) => grant.conversationId)
                    .filter((id): id is string => typeof id === "string"),
                },
              },
            ],
          },
          select: {
            id: true,
            contextId: true,
            openAt: true,
            readOnlyAt: true,
            closeAt: true,
            lastMessageAt: true,
            lastMessage: {
              select: {
                id: true,
                body: true,
                createdAt: true,
                deletedAt: true,
              },
            },
          },
        })
      : [];

    const eventConversationByEventId = new Map<number, (typeof eventConversations)[number]>();
    const eventConversationById = new Map<string, (typeof eventConversations)[number]>();
    for (const conversation of eventConversations) {
      const eventId = Number(conversation.contextId ?? "");
      if (Number.isFinite(eventId) && !eventConversationByEventId.has(eventId)) {
        eventConversationByEventId.set(eventId, conversation);
      }
      eventConversationById.set(conversation.id, conversation);
    }

    const eventRows = eventIds.length
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
      : ([] as EventRow[]);

    const eventMap = new Map(eventRows.map((event) => [event.id, event] as const));

    const eventConversationIds = Array.from(
      new Set(
        [...eventConversationByEventId.values(), ...eventConversationById.values()]
          .map((conversation) => conversation.id)
          .filter(Boolean),
      ),
    );

    const eventMutes = eventConversationIds.length
      ? await prisma.chatConversationMember.findMany({
          where: {
            userId: user.id,
            conversationId: { in: eventConversationIds },
          },
          select: {
            conversationId: true,
            mutedUntil: true,
          },
        })
      : [];

    const eventMuteMap = new Map(
      eventMutes.map((row) => [row.conversationId, row.mutedUntil ? row.mutedUntil.toISOString() : null]),
    );

    const eventItems = eventIds
      .map((eventId) => {
        const event = eventMap.get(eventId);
        if (!event) return null;

        const grant = grantByEvent.get(eventId);
        if (!grant) return null;

        const conversation =
          (grant.conversationId ? eventConversationById.get(grant.conversationId) : null) ??
          eventConversationByEventId.get(eventId) ??
          null;

        const lastMessage = conversation?.lastMessage ?? null;
        const lastBody = lastMessage?.deletedAt ? null : lastMessage?.body;
        const lastMessageAt =
          (conversation?.lastMessageAt ?? lastMessage?.createdAt ?? event.startsAt ?? null)?.toISOString() ??
          null;

        return {
          id: `event:${grant.id}`,
          kind: "EVENT" as const,
          conversationId: grant.conversationId ?? conversation?.id ?? null,
          threadId: grant.threadId ?? conversation?.id ?? null,
          status: resolveEventStatus({
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            openAt: conversation?.openAt ?? null,
            readOnlyAt: conversation?.readOnlyAt ?? null,
            closeAt: conversation?.closeAt ?? null,
          }),
          title: event.title,
          subtitle: event.addressRef?.formattedAddress ?? null,
          imageUrl: event.coverImageUrl ?? null,
          lastMessageAt,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastBody,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
          unreadCount: 0,
          mutedUntil: conversation ? eventMuteMap.get(conversation.id) ?? null : null,
          event: {
            id: event.id,
            slug: event.slug,
            startsAt: event.startsAt ? event.startsAt.toISOString() : null,
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          },
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const memberships = await membershipsPromise;

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
    console.error("[api/messages/inbox] error", err);
    return jsonWrap({ error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
