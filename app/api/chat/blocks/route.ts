export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);

    const payload = (await req.json().catch(() => null)) as { userId?: unknown; reason?: unknown } | null;
    const blockedId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    const reason = typeof payload?.reason === "string" ? payload.reason.trim() : null;

    if (!blockedId || blockedId === user.id) {
      return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: organization.id, userId: blockedId },
      select: { userId: true },
    });
    if (!membership) {
      return NextResponse.json({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
    }

    const block = await prisma.chatUserBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      create: { blockerId: user.id, blockedId, reason: reason || undefined },
      update: { reason: reason || undefined },
    });

    console.log("[chat] utilizador bloqueado", { blockerId: user.id, blockedId });

    return NextResponse.json({ ok: true, block });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/blocks error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao bloquear." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user } = await requireChatContext(req);

    const payload = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    const blockedId = typeof payload?.userId === "string" ? payload.userId.trim() : "";

    if (!blockedId) {
      return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
    }

    await prisma.chatUserBlock.deleteMany({
      where: { blockerId: user.id, blockedId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("DELETE /api/chat/blocks error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao desbloquear." }, { status: 500 });
  }
}
