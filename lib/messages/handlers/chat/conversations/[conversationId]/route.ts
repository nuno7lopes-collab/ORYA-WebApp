export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
} as const;

async function _PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  try {

    const { user, organization } = await requireChatContext(req);
    const { conversationId } = await context.params;
    const payload = (await req.json().catch(() => null)) as {
      title?: unknown;
    } | null;

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (title.length < 2) {
      return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        ...ACTIVE_MEMBER_FILTER,
        conversation: { organizationId: organization.id },
      },
      select: {
        role: true,
        conversation: { select: { id: true, type: true, title: true } },
      },
    });

    if (!member?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (member.conversation.type === "DIRECT") {
      return jsonWrap({ ok: false, error: "NOT_ALLOWED" }, { status: 400 });
    }

    if (member.role !== "ADMIN") {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title },
      select: { id: true, title: true, type: true },
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "conversation:update",
      action: "updated",
      organizationId: organization.id,
      conversationId: updated.id,
      conversation: updated,
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({ ok: true, conversation: updated, ...(warnings.length ? { warnings } : {}) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/messages/conversations/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar conversa." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
