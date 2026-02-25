export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ChatConversationContextType } from "@prisma/client";

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

async function _POST(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const conversationId = context.params.conversationId;
    const payload = (await req.json().catch(() => null)) as { messageId?: unknown } | null;
    const messageId = typeof payload?.messageId === "string" ? payload.messageId.trim() : null;

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        ...ACTIVE_MEMBER_FILTER,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      select: {
        conversationId: true,
        userId: true,
        lastReadMessage: { select: { id: true, createdAt: true } },
        conversation: {
          select: {
            contextType: true,
            members: {
              where: ACTIVE_MEMBER_FILTER,
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!member) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (member.conversation.contextType === ChatConversationContextType.USER_DM) {
      const peerId = member.conversation.members.find((entry) => entry.userId !== user.id)?.userId ?? null;
      if (peerId) {
        const block = await prisma.chatUserBlock.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: peerId },
              { blockerId: peerId, blockedId: user.id },
            ],
          },
          select: { id: true },
        });
        if (block) {
          return jsonWrap({ error: "CHAT_BLOCKED" }, { status: 403 });
        }
      }
    }

    let resolvedMessage:
      | {
          id: string;
          createdAt: Date;
        }
      | null = null;

    if (messageId) {
      resolvedMessage = await prisma.chatConversationMessage.findFirst({
        where: { id: messageId, conversationId },
        select: { id: true, createdAt: true },
      });
      if (!resolvedMessage) {
        return jsonWrap({ error: "INVALID_MESSAGE" }, { status: 400 });
      }
    } else {
      const latest = await prisma.chatConversationMessage.findFirst({
        where: { conversationId, deletedAt: null, replyToId: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true },
      });
      resolvedMessage = latest ?? null;
    }

    const current = member.lastReadMessage;
    if (current && resolvedMessage) {
      const currentTime = current.createdAt.getTime();
      const nextTime = resolvedMessage.createdAt.getTime();
      const shouldAdvance = nextTime > currentTime || (nextTime === currentTime && resolvedMessage.id >= current.id);
      if (!shouldAdvance) {
        return jsonWrap({ ok: true, updated: false, lastReadMessageId: current.id });
      }
    }

    await prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        lastReadMessageId: resolvedMessage?.id ?? null,
        lastReadAt: resolvedMessage?.createdAt ?? new Date(),
      },
    });

    return jsonWrap({
      ok: true,
      updated: true,
      lastReadMessageId: resolvedMessage?.id ?? null,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/conversations/read] error", err);
    return jsonWrap({ error: "Erro ao marcar leitura." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
