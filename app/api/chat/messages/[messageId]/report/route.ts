export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { messageId } = await context.params;

    const message = await prisma.chatConversationMessage.findFirst({
      where: {
        id: messageId,
        conversation: {
          organizationId: organization.id,
          members: { some: { userId: user.id } },
        },
      },
      select: { id: true },
    });

    if (!message) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    const payload = (await req.json().catch(() => null)) as { reason?: unknown; metadata?: unknown } | null;
    const reason = typeof payload?.reason === "string" ? payload.reason.trim() : null;
    const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

    await prisma.chatMessageReport.create({
      data: {
        messageId,
        reporterId: user.id,
        reason: reason || undefined,
        metadata,
      },
    });

    console.log("[chat] mensagem reportada", { messageId, reporterId: user.id });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/messages/[id]/report error:", err);
    return jsonWrap({ ok: false, error: "Erro ao reportar mensagem." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);