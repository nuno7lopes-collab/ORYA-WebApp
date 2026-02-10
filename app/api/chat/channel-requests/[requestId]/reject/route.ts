export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ADMIN_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN"]);

async function _POST(req: NextRequest, context: { params: { requestId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);
    if (!membership?.role || !ADMIN_ROLES.has(membership.role)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const requestId = context.params.requestId;
    if (!requestId) {
      return jsonWrap({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const request = await prisma.chatChannelRequest.findFirst({
      where: { id: requestId, organizationId: organization.id, status: "PENDING" },
      select: { id: true },
    });

    if (!request) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.chatChannelRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolvedByUserId: user.id,
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
    console.error("POST /api/chat/channel-requests/[id]/reject error:", err);
    return jsonWrap({ ok: false, error: "Erro ao rejeitar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
