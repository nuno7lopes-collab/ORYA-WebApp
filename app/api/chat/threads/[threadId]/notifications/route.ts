export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _PATCH(req: NextRequest, context: { params: { threadId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const threadId = context.params.threadId;
    const payload = (await req.json().catch(() => null)) as { mutedUntil?: unknown } | null;

    const mutedUntilRaw = payload?.mutedUntil;
    const mutedUntil =
      typeof mutedUntilRaw === "string" && mutedUntilRaw.length > 0 ? new Date(mutedUntilRaw) : null;

    if (mutedUntil && Number.isNaN(mutedUntil.getTime())) {
      return jsonWrap({ error: "INVALID_MUTE" }, { status: 400 });
    }

    const member = await prisma.chatMember.findFirst({
      where: { threadId, userId: user.id, bannedAt: null },
      select: { threadId: true },
    });

    if (!member) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatMember.update({
      where: { threadId_userId: { threadId, userId: user.id } },
      data: { mutedUntil: mutedUntilRaw === null ? null : mutedUntil ?? undefined },
      select: { mutedUntil: true },
    });

    return jsonWrap({ ok: true, mutedUntil: updated.mutedUntil?.toISOString() ?? null });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads/notifications] error", err);
    return jsonWrap({ error: "Erro ao atualizar notificações." }, { status: 500 });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
