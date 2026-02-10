export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent, type ChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ChatConversationContextType } from "@prisma/client";

const B2C_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.USER_DM,
  ChatConversationContextType.USER_GROUP,
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.BOOKING,
  ChatConversationContextType.SERVICE,
];
const UNDO_WINDOW_MS = 2 * 60 * 1000;

async function _DELETE(req: NextRequest, context: { params: { conversationId: string; messageId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const conversationId = context.params.conversationId;
    const messageId = context.params.messageId;

    const membership = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      select: { conversationId: true },
    });

    if (!membership) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const message = await prisma.chatConversationMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      select: { id: true, senderId: true, createdAt: true },
    });

    if (!message) {
      return jsonWrap({ error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    if (message.senderId !== user.id) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const elapsed = Date.now() - message.createdAt.getTime();
    if (elapsed > UNDO_WINDOW_MS) {
      return jsonWrap({ error: "UNDO_EXPIRED" }, { status: 403 });
    }

    const updated = await prisma.chatConversationMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, lastMessageId: messageId },
      select: { id: true },
    });

    let lastMessage: { id: string; body: string | null; createdAt: Date; senderId: string | null } | null | undefined = undefined;
    if (conversation) {
      const latest = await prisma.chatConversationMessage.findFirst({
        where: { conversationId, deletedAt: null, replyToId: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, body: true, createdAt: true, senderId: true },
      });
      lastMessage = latest ?? null;
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { lastMessageId: latest?.id ?? null, lastMessageAt: latest?.createdAt ?? null },
      });
    }

    const deletedAt = updated.deletedAt ?? new Date();
    const eventPayload: ChatEvent = {
      type: "message:delete",
      conversationId,
      messageId,
      deletedAt: deletedAt.toISOString(),
    };
    if (lastMessage !== undefined) {
      eventPayload.lastMessage = lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            createdAt: lastMessage.createdAt.toISOString(),
            senderId: lastMessage.senderId,
          }
        : null;
    }

    await publishChatEvent(eventPayload);

    return jsonWrap({ ok: true, deletedAt: deletedAt.toISOString() });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/conversations/messages/delete] error", err);
    return jsonWrap({ error: "Erro ao remover mensagem." }, { status: 500 });
  }
}

export const DELETE = withApiEnvelope(_DELETE);
