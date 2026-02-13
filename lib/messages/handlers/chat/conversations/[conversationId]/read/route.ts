export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, context: { params: { conversationId: string } }) {
  try {

    const { user, organization } = await requireChatContext(req);

    const { conversationId } = await context.params;
    const payload = (await req.json().catch(() => null)) as { lastReadMessageId?: unknown } | null;
    const lastReadMessageId =
      typeof payload?.lastReadMessageId === "string" ? payload.lastReadMessageId.trim() : "";

    if (!lastReadMessageId) {
      return jsonWrap({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      include: {
        lastReadMessage: { select: { id: true, createdAt: true } },
      },
    });

    if (!member) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const messageExists = await prisma.chatConversationMessage.findFirst({
      where: { id: lastReadMessageId, conversationId },
      select: { id: true, createdAt: true },
    });

    if (!messageExists) {
      return jsonWrap({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const current = member.lastReadMessage;
    if (current) {
      const currentTime = current.createdAt.getTime();
      const nextTime = messageExists.createdAt.getTime();
      const shouldAdvance =
        nextTime > currentTime ||
        (nextTime === currentTime && messageExists.id >= current.id);
      if (!shouldAdvance) {
        return jsonWrap({ ok: true, updated: false });
      }
    }

    await prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadMessageId, lastReadAt: messageExists.createdAt },
    });

    await publishChatEvent({
      type: "message:read",
      organizationId: organization.id,
      conversationId,
      userId: user.id,
      lastReadMessageId,
    });

    return jsonWrap({ ok: true, updated: true });
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
    console.error("POST /api/messages/conversations/[id]/read error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar leitura." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
