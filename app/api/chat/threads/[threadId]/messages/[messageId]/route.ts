export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const UNDO_WINDOW_MS = 2 * 60 * 1000;

async function _DELETE(req: NextRequest, context: { params: { threadId: string; messageId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const threadId = context.params.threadId;
    const messageId = context.params.messageId;

    const member = await prisma.chatMember.findFirst({
      where: { threadId, userId: user.id, bannedAt: null },
      select: { userId: true },
    });

    if (!member) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, threadId, deletedAt: null },
      select: { id: true, userId: true, createdAt: true },
    });

    if (!message) {
      return jsonWrap({ error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    if (message.userId !== user.id) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const elapsed = Date.now() - message.createdAt.getTime();
    if (elapsed > UNDO_WINDOW_MS) {
      return jsonWrap({ error: "UNDO_EXPIRED" }, { status: 403 });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    return jsonWrap({ ok: true, deletedAt: updated.deletedAt?.toISOString() ?? new Date().toISOString() });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads/messages/delete] error", err);
    return jsonWrap({ error: "Erro ao remover mensagem." }, { status: 500 });
  }
}

export const DELETE = withApiEnvelope(_DELETE);
