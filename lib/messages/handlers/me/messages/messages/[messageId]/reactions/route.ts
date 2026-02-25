export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ChatConversationContextType } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const B2C_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.EVENT,
  ChatConversationContextType.USER_DM,
  ChatConversationContextType.USER_GROUP,
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.BOOKING,
  ChatConversationContextType.SERVICE,
  ChatConversationContextType.ORG_COMMUNITY,
];

const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
} as const;

function parseEmoji(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 16);
}

async function ensureB2CMessageAccess(params: { messageId: string; userId: string }) {
  const message = await prisma.chatConversationMessage.findFirst({
    where: {
      id: params.messageId,
      conversation: {
        contextType: { in: B2C_CONTEXT_TYPES },
        members: {
          some: {
            userId: params.userId,
            ...ACTIVE_MEMBER_FILTER,
          },
        },
      },
    },
    select: {
      id: true,
      conversationId: true,
      conversation: {
        select: {
          organizationId: true,
          contextType: true,
          members: {
            where: ACTIVE_MEMBER_FILTER,
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!message?.conversation) return null;

  if (message.conversation.contextType === ChatConversationContextType.USER_DM) {
    const peerId =
      message.conversation.members.find((entry) => entry.userId !== params.userId)?.userId ?? null;
    if (peerId) {
      const block = await prisma.chatUserBlock.findFirst({
        where: {
          OR: [
            { blockerId: params.userId, blockedId: peerId },
            { blockerId: peerId, blockedId: params.userId },
          ],
        },
        select: { id: true },
      });
      if (block) return null;
    }
  }

  return message;
}

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  try {
    const params = await context.params;
    const messageId = params.messageId?.trim();
    if (!messageId) {
      return jsonWrap({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as { emoji?: unknown } | null;
    const emoji = parseEmoji(payload?.emoji);
    if (!emoji) {
      return jsonWrap({ ok: false, error: "INVALID_EMOJI" }, { status: 400 });
    }

    const message = await ensureB2CMessageAccess({ messageId, userId: user.id });
    if (!message?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = await prisma.chatMessageReaction.findFirst({
      where: { messageId, userId: user.id },
      select: { emoji: true },
    });

    if (existing?.emoji === emoji) {
      await prisma.chatMessageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
      });
    } else {
      await prisma.chatMessageReaction.deleteMany({
        where: { messageId, userId: user.id },
      });

      await prisma.chatMessageReaction.create({
        data: { messageId, userId: user.id, emoji },
      });
    }

    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "reaction:update",
      organizationId: message.conversation.organizationId ?? undefined,
      conversationId: message.conversationId,
      messageId,
      reactions,
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({ ok: true, ...(warnings.length ? { warnings } : {}) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/messages/messages/[messageId]/reactions?scope=b2c error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  try {
    const params = await context.params;
    const messageId = params.messageId?.trim();
    if (!messageId) {
      return jsonWrap({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as { emoji?: unknown } | null;
    const emoji = parseEmoji(payload?.emoji);
    if (!emoji) {
      return jsonWrap({ ok: false, error: "INVALID_EMOJI" }, { status: 400 });
    }

    const message = await ensureB2CMessageAccess({ messageId, userId: user.id });
    if (!message?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    await prisma.chatMessageReaction.deleteMany({
      where: { messageId, userId: user.id, emoji },
    });

    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "reaction:update",
      organizationId: message.conversation.organizationId ?? undefined,
      conversationId: message.conversationId,
      messageId,
      reactions,
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({ ok: true, ...(warnings.length ? { warnings } : {}) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("DELETE /api/messages/messages/[messageId]/reactions?scope=b2c error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
