export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { OrganizationMemberRole } from "@prisma/client";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function isAdminRole(role: OrganizationMemberRole) {
  return (
    role === OrganizationMemberRole.OWNER ||
    role === OrganizationMemberRole.CO_OWNER ||
    role === OrganizationMemberRole.ADMIN
  );
}

async function _POST(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { messageId } = await context.params;

    const message = await prisma.chatConversationMessage.findFirst({
      where: {
        id: messageId,
        conversation: { organizationId: organization.id, members: { some: { userId: user.id } } },
      },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    try {
      await prisma.chatMessagePin.create({
        data: { messageId, pinnedBy: user.id },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }

    const pins = await prisma.chatMessagePin.findMany({
      where: { messageId },
      select: { id: true, messageId: true, pinnedBy: true, pinnedAt: true },
    });
    await publishChatEvent({
      type: "pin:update",
      organizationId: organization.id,
      conversationId: message.conversationId,
      messageId,
      pins,
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    if (isChatRedisUnavailableError(err)) {
      return jsonWrap({ ok: false, error: err.code }, { status: 503 });
    }
    console.error("POST /api/messages/messages/[id]/pins error:", err);
    return jsonWrap({ ok: false, error: "Erro ao fixar mensagem." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);
    const { messageId } = await context.params;

    const message = await prisma.chatConversationMessage.findFirst({
      where: {
        id: messageId,
        conversation: { organizationId: organization.id, members: { some: { userId: user.id } } },
      },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    const pin = await prisma.chatMessagePin.findFirst({
      where: { messageId },
      select: { id: true, pinnedBy: true },
    });

    if (!pin) {
      return jsonWrap({ ok: true });
    }

    const canUnpin = pin.pinnedBy === user.id || (membership?.role && isAdminRole(membership.role));
    if (!canUnpin) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    await prisma.chatMessagePin.delete({ where: { id: pin.id } });

    const pins = await prisma.chatMessagePin.findMany({
      where: { messageId },
      select: { id: true, messageId: true, pinnedBy: true, pinnedAt: true },
    });
    await publishChatEvent({
      type: "pin:update",
      organizationId: organization.id,
      conversationId: message.conversationId,
      messageId,
      pins,
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    if (isChatRedisUnavailableError(err)) {
      return jsonWrap({ ok: false, error: err.code }, { status: 503 });
    }
    console.error("DELETE /api/messages/messages/[id]/pins error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover pin." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
