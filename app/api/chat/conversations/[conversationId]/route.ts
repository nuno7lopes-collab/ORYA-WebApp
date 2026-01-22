export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent } from "@/lib/chat/redis";

export async function PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { conversationId } = await context.params;
    const payload = (await req.json().catch(() => null)) as {
      title?: unknown;
    } | null;

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (title.length < 2) {
      return NextResponse.json({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      select: {
        role: true,
        conversation: { select: { id: true, type: true, title: true } },
      },
    });

    if (!member?.conversation) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (member.conversation.type === "DIRECT") {
      return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 400 });
    }

    if (member.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title },
      select: { id: true, title: true, type: true },
    });

    await publishChatEvent({
      type: "conversation:update",
      action: "updated",
      organizationId: organization.id,
      conversationId: updated.id,
      conversation: updated,
    });

    return NextResponse.json({ ok: true, conversation: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/chat/conversations/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar conversa." }, { status: 500 });
  }
}
