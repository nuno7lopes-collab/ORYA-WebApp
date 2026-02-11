export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import { OrganizationMemberRole } from "@prisma/client";
import { isChatRedisUnavailableError, publishChatEvent, type ChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function isAdminRole(role: OrganizationMemberRole) {
  return (
    role === OrganizationMemberRole.OWNER ||
    role === OrganizationMemberRole.CO_OWNER ||
    role === OrganizationMemberRole.ADMIN
  );
}

async function _PATCH(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { messageId } = await context.params;

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body || body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const message = await prisma.chatConversationMessage.findFirst({
      where: {
        id: messageId,
        senderId: user.id,
        deletedAt: null,
        conversation: { organizationId: organization.id, members: { some: { userId: user.id } } },
      },
      select: { id: true },
    });

    if (!message) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversationMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          },
        },
        pins: true,
        replyTo: {
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    });

    await publishChatEvent({
      type: "message:update",
      organizationId: organization.id,
      conversationId: updated.conversationId,
      message: updated,
    });

    return jsonWrap({ ok: true, message: updated });
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
    console.error("PATCH /api/messages/messages/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao editar mensagem." }, { status: 500 });
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
        deletedAt: null,
        conversation: { organizationId: organization.id, members: { some: { userId: user.id } } },
      },
      select: { id: true, senderId: true, conversationId: true },
    });

    if (!message) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    const canDelete = message.senderId === user.id || (membership?.role && isAdminRole(membership.role));
    if (!canDelete) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.chatConversationMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: message.conversationId, lastMessageId: messageId },
      select: { id: true },
    });

    let lastMessage = undefined as
      | undefined
      | null
      | {
        id: string;
        body: string | null;
        createdAt: Date;
        senderId: string | null;
      };

    if (conversation) {
      const latest = await prisma.chatConversationMessage.findFirst({
        where: { conversationId: message.conversationId, deletedAt: null, replyToId: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, body: true, createdAt: true, senderId: true },
      });
      if (latest) {
        lastMessage = latest;
      }
      await prisma.chatConversation.update({
        where: { id: message.conversationId },
        data: {
          lastMessageId: latest?.id ?? null,
          lastMessageAt: latest?.createdAt ?? null,
        },
      });
    }

    const deletedAt = updated.deletedAt ?? new Date();
    const eventPayload: ChatEvent = {
      type: "message:delete",
      organizationId: organization.id,
      conversationId: message.conversationId,
      messageId,
      deletedAt: deletedAt.toISOString(),
    };

    if (lastMessage !== undefined) {
      eventPayload.lastMessage = lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            createdAt: lastMessage.createdAt.toISOString(),
            senderId: lastMessage.senderId,
          }
        : null;
    }

    await publishChatEvent(eventPayload);

    return jsonWrap({ ok: true, deletedAt });
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
    console.error("DELETE /api/messages/messages/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao apagar mensagem." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
