export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {

    const { user, organization } = await requireChatContext(req);

    const payload = (await req.json().catch(() => null)) as { userId?: unknown; reason?: unknown } | null;
    const blockedId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    const reason = typeof payload?.reason === "string" ? payload.reason.trim() : null;

    if (!blockedId || blockedId === user.id) {
      return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
    }

    const membership = await resolveGroupMemberForOrg({
      organizationId: organization.id,
      userId: blockedId,
    });
    if (!membership) {
      return jsonWrap({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
    }

    const block = await prisma.chatUserBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      create: { blockerId: user.id, blockedId, reason: reason || undefined },
      update: { reason: reason || undefined },
    });

    console.log("[chat] utilizador bloqueado", { blockerId: user.id, blockedId });

    return jsonWrap({ ok: true, block });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/blocks error:", err);
    return jsonWrap({ ok: false, error: "Erro ao bloquear." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest) {
  try {

    const { user } = await requireChatContext(req);

    const payload = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    const blockedId = typeof payload?.userId === "string" ? payload.userId.trim() : "";

    if (!blockedId) {
      return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
    }

    await prisma.chatUserBlock.deleteMany({
      where: { blockerId: user.id, blockedId },
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("DELETE /api/messages/blocks error:", err);
    return jsonWrap({ ok: false, error: "Erro ao desbloquear." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);