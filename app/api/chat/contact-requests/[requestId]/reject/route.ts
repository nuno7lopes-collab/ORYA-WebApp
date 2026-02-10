export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, context: { params: { requestId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { organization } = await requireChatContext(req);

    const requestId = typeof context.params.requestId === "string" ? context.params.requestId.trim() : "";
    if (!requestId) {
      return jsonWrap({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const request = await prisma.chatConversationRequest.findFirst({
      where: {
        id: requestId,
        targetOrganizationId: organization.id,
        status: "PENDING",
        contextType: { in: ["ORG_CONTACT", "SERVICE"] },
      },
      select: { id: true },
    });

    if (!request) {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
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
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/contact-requests/reject error:", err);
    return jsonWrap({ ok: false, error: "Erro ao rejeitar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
