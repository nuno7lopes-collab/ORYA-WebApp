export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { publishChatEvent } from "@/lib/chat/redis";
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
      select: { id: true, title: true, requesterId: true },
    });

    if (!request) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const conversation = await prisma.$transaction(async (tx) => {
      const created = await tx.chatConversation.create({
        data: {
          organizationId: organization.id,
          type: "CHANNEL",
          contextType: "ORG_CHANNEL",
          title: request.title,
          createdByUserId: user.id,
          members: {
            create: [
              { userId: user.id, role: "ADMIN", organizationId: organization.id },
              { userId: request.requesterId, role: "MEMBER", organizationId: organization.id },
            ],
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
          },
        },
      });

      await tx.chatChannelRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
          updatedAt: new Date(),
        },
      });

      return created;
    });

    await publishChatEvent({
      type: "conversation:update",
      action: "created",
      organizationId: organization.id,
      conversationId: conversation.id,
      conversation,
    });

    return jsonWrap({ ok: true, conversation });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/channel-requests/[id]/approve error:", err);
    return jsonWrap({ ok: false, error: "Erro ao aprovar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
