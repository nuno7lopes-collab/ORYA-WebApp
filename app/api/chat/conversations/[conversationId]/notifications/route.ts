export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";

const LEVELS = new Set(["ALL", "MENTIONS_ONLY", "OFF"]);

export async function PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

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
      return NextResponse.json({ ok: false, error: "INVALID_LEVEL" }, { status: 400 });
    }
    if (mutedUntil && Number.isNaN(mutedUntil.getTime())) {
      return NextResponse.json({ ok: false, error: "INVALID_MUTE" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        notifLevel: notifLevel ? (notifLevel as "ALL" | "MENTIONS_ONLY" | "OFF") : undefined,
        mutedUntil: mutedUntilRaw === null ? null : mutedUntil ?? undefined,
      },
      select: { notifLevel: true, mutedUntil: true },
    });

    return NextResponse.json({
      ok: true,
      notifLevel: updated.notifLevel,
      mutedUntil: updated.mutedUntil,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/chat/conversations/[id]/notifications error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar notificacoes." }, { status: 500 });
  }
}
