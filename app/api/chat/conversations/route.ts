export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseLimit(value: string | null) {
  const raw = Number(value ?? "30");
  if (!Number.isFinite(raw)) return 30;
  return Math.min(Math.max(raw, 1), 100);
}

function parseSince(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function resolveTitleFallback(
  members: Array<{ userId: string; fullName: string | null; username: string | null }>,
  viewerId: string,
) {
  const other = members.find((member) => member.userId !== viewerId) ?? null;
  if (!other) return "Conversa";
  return other.fullName?.trim() || (other.username ? `@${other.username}` : "Conversa");
}

async function _GET(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 60,
      keyPrefix: "chat:conversations",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const updatedAfter = parseSince(req.nextUrl.searchParams.get("updatedAfter"));

    const memberships = await prisma.chatConversationMember.findMany({
      where: {
        userId: user.id,
        conversation: updatedAfter
          ? {
              organizationId: organization.id,
              type: "CHANNEL",
              OR: [
                { lastMessageAt: { gt: updatedAfter } },
                { lastMessageAt: null, createdAt: { gt: updatedAfter } },
              ],
            }
          : { organizationId: organization.id, type: "CHANNEL" },
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
            lastMessageId: true,
            lastMessage: {
              select: {
                id: true,
                body: true,
                createdAt: true,
                senderId: true,
              },
            },
            members: {
              select: {
                userId: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: "desc" } },
      take: limit,
    });

    const memberIds = new Set<string>();
    memberships.forEach((entry) => {
      entry.conversation.members.forEach((member) => memberIds.add(member.userId));
    });

    const presenceRows = memberIds.size
      ? await prisma.chatUserPresence.findMany({
          where: { userId: { in: Array.from(memberIds) } },
          select: { userId: true, lastSeenAt: true },
        })
      : [];

    const presenceMap = new Map(presenceRows.map((row) => [row.userId, row.lastSeenAt]));

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

    const items = memberships.map((entry, idx) => {
      const conv = entry.conversation;
      const members = conv.members.map((member) => ({
        userId: member.userId,
        role: member.role,
        fullName: member.user.fullName,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
        lastSeenAt: presenceMap.get(member.userId) ?? null,
      }));

      const fallbackTitle =
        conv.type === "DIRECT"
          ? resolveTitleFallback(members, user.id)
          : conv.type === "CHANNEL"
            ? "Canal"
            : "Grupo";

      return {
        id: conv.id,
        type: conv.type,
        contextType: conv.contextType,
        contextId: conv.contextId,
        customerId: conv.customerId,
        professionalId: conv.professionalId,
        title: conv.title ?? fallbackTitle,
        lastMessageAt: conv.lastMessageAt,
        lastMessage: conv.lastMessage,
        unreadCount: unreadCountMap.get(conv.id) ?? 0,
        members,
        viewerLastReadMessageId: entry.lastReadMessage?.id ?? null,
        mutedUntil: entry.mutedUntil,
        notifLevel: entry.notifLevel,
      };
    });

    return jsonWrap({ ok: true, items, viewerRole: membership.role });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    if (isChatRedisUnavailableError(err)) {
      return jsonWrap({ ok: false, error: err.code }, { status: 503 });
    }
    console.error("GET /api/chat/conversations error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar conversas." }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 60 * 1000,
      max: 20,
      keyPrefix: "chat:conversations:create",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const payload = (await req.json().catch(() => null)) as {
      type?: unknown;
      title?: unknown;
      memberIds?: unknown;
    } | null;

    const typeRaw = typeof payload?.type === "string" ? payload?.type.trim().toUpperCase() : null;
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const memberIds = Array.isArray(payload?.memberIds)
      ? payload?.memberIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    const isChannel = typeRaw ? typeRaw === "CHANNEL" : true;
    if (!isChannel) {
      return jsonWrap({ ok: false, error: "ONLY_CHANNELS" }, { status: 400 });
    }

    if (title.length < 2) {
      return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }

    const uniqueMembers = Array.from(new Set([user.id, ...memberIds]));
    if (uniqueMembers.length < 1) {
      return jsonWrap({ ok: false, error: "INVALID_MEMBERS" }, { status: 400 });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { organizationId: organization.id, userId: { in: uniqueMembers } },
      select: { userId: true },
    });

    if (memberships.length !== uniqueMembers.length) {
      return jsonWrap({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
    }

    const adminRoles = new Set(["OWNER", "CO_OWNER", "ADMIN"]);
    const isAdmin = membership?.role ? adminRoles.has(membership.role) : false;

    if (!isAdmin) {
      const request = await prisma.chatChannelRequest.create({
        data: {
          organizationId: organization.id,
          requesterId: user.id,
          title,
        },
        select: { id: true },
      });

      return jsonWrap(
        { ok: true, pending: true, requestId: request.id },
        { status: 202 },
      );
    }

    const conversation = await prisma.chatConversation.create({
      data: {
        organizationId: organization.id,
        type: "CHANNEL",
        contextType: "ORG_CHANNEL",
        title,
        createdByUserId: user.id,
        members: {
          create: uniqueMembers.map((memberId) => ({
            userId: memberId,
            role: memberId === user.id ? "ADMIN" : "MEMBER",
            organizationId: organization.id,
          })),
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
        },
      },
    });

    await publishChatEvent({
      type: "conversation:update",
      action: "created",
      organizationId: organization.id,
      conversationId: conversation.id,
      conversation,
    });

    console.log("[chat] canal criado", { conversationId: conversation.id, actor: user.id });

    return jsonWrap({ ok: true, conversation }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    if (isChatRedisUnavailableError(err)) {
      return jsonWrap({ ok: false, error: err.code }, { status: 503 });
    }
    console.error("POST /api/chat/conversations error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar conversa." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
