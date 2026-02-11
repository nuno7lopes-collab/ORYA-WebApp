export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { conversationId } = await context.params;

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      select: {
        role: true,
        conversation: { select: { id: true, type: true } },
      },
    });

    if (!member?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (member.conversation.type === "DIRECT") {
      return jsonWrap({ ok: false, error: "NOT_ALLOWED" }, { status: 400 });
    }

    let action: "left" | "deleted" = "left";
    await prisma.$transaction(async (tx) => {
      await tx.chatConversationMember.delete({
        where: { conversationId_userId: { conversationId, userId: user.id } },
      });

      const remaining = await tx.chatConversationMember.findMany({
        where: { conversationId },
        orderBy: { joinedAt: "asc" },
        select: { userId: true, role: true, joinedAt: true },
      });

      if (remaining.length === 0) {
        await tx.chatConversation.delete({ where: { id: conversationId } });
        action = "deleted";
        return;
      }

      const hasAdmin = remaining.some((entry) => entry.role === "ADMIN");
      if (!hasAdmin) {
        await tx.chatConversationMember.update({
          where: {
            conversationId_userId: { conversationId, userId: remaining[0].userId },
          },
          data: { role: "ADMIN" },
        });
      }
    });

    await publishChatEvent({
      type: "conversation:update",
      action,
      organizationId: organization.id,
      conversationId,
    });

    return jsonWrap({ ok: true, action });
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
    console.error("POST /api/chat/conversations/[id]/leave error:", err);
    return jsonWrap({ ok: false, error: "Erro ao sair da conversa." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
