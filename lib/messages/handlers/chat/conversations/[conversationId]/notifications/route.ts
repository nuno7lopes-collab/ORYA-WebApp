export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const LEVELS = new Set(["ALL", "MENTIONS_ONLY", "OFF"]);

async function _PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  try {

    const { user, organization } = await requireChatContext(req);
    const { conversationId } = await context.params;

    const payload = (await req.json().catch(() => null)) as {
      notifLevel?: unknown;
      mutedUntil?: unknown;
    } | null;

    const notifLevel =
      typeof payload?.notifLevel === "string" ? payload.notifLevel.trim().toUpperCase() : null;
    const mutedUntilRaw = payload?.mutedUntil;
    const mutedUntil =
      typeof mutedUntilRaw === "string" && mutedUntilRaw.length > 0
        ? new Date(mutedUntilRaw)
        : null;

    if (notifLevel && !LEVELS.has(notifLevel)) {
      return jsonWrap({ ok: false, error: "INVALID_LEVEL" }, { status: 400 });
    }
    if (mutedUntil && Number.isNaN(mutedUntil.getTime())) {
      return jsonWrap({ ok: false, error: "INVALID_MUTE" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      select: { conversationId: true, userId: true },
    });

    if (!member) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        notifLevel: notifLevel ? (notifLevel as "ALL" | "MENTIONS_ONLY" | "OFF") : undefined,
        mutedUntil: mutedUntilRaw === null ? null : mutedUntil ?? undefined,
      },
      select: { notifLevel: true, mutedUntil: true },
    });

    return jsonWrap({
      ok: true,
      notifLevel: updated.notifLevel,
      mutedUntil: updated.mutedUntil,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/messages/conversations/[id]/notifications error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar notificacoes." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);