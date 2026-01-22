export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent } from "@/lib/chat/redis";

export async function POST(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);

    const { conversationId } = await context.params;
    const payload = (await req.json().catch(() => null)) as { lastReadMessageId?: unknown } | null;
    const lastReadMessageId =
      typeof payload?.lastReadMessageId === "string" ? payload.lastReadMessageId.trim() : "";

    if (!lastReadMessageId) {
      return NextResponse.json({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const messageExists = await prisma.chatConversationMessage.findFirst({
      where: { id: lastReadMessageId, conversationId },
      select: { id: true, createdAt: true },
    });

    if (!messageExists) {
      return NextResponse.json({ ok: false, error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const current = member.lastReadMessage;
    if (current) {
      const currentTime = current.createdAt.getTime();
      const nextTime = messageExists.createdAt.getTime();
      const shouldAdvance =
        nextTime > currentTime ||
        (nextTime === currentTime && messageExists.id >= current.id);
      if (!shouldAdvance) {
        return NextResponse.json({ ok: true, updated: false });
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

    return NextResponse.json({ ok: true, updated: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/conversations/[id]/read error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar leitura." }, { status: 500 });
  }
}
