export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, context: { params: { requestId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const requestId = typeof context.params.requestId === "string" ? context.params.requestId.trim() : "";
    if (!requestId) {
      return jsonWrap({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const request = await prisma.chatConversationRequest.findFirst({
      where: { id: requestId, targetUserId: user.id, status: "PENDING", contextType: "USER_DM" },
      select: { id: true },
    });

    if (!request) {
      return jsonWrap({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }

    await prisma.chatConversationRequest.update({
      where: { id: request.id },
      data: {
        status: "DECLINED",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/requests/decline] error", err);
    return jsonWrap({ error: "Erro ao recusar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
