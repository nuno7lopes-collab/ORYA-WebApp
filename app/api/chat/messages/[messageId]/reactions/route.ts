export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseEmoji(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 16);
}

async function _POST(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { messageId } = await context.params;
    const payload = (await req.json().catch(() => null)) as { emoji?: unknown } | null;
    const emoji = parseEmoji(payload?.emoji);

    if (!emoji) {
      return jsonWrap({ ok: false, error: "INVALID_EMOJI" }, { status: 400 });
    }

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

    const existing = await prisma.chatMessageReaction.findFirst({
      where: { messageId, userId: user.id },
      select: { emoji: true },
    });

    if (existing?.emoji === emoji) {
      await prisma.chatMessageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
      });
      const reactions = await prisma.chatMessageReaction.findMany({
        where: { messageId },
        include: {
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });
      await publishChatEvent({
        type: "reaction:update",
        organizationId: organization.id,
        conversationId: message.conversationId,
        messageId,
        reactions,
      });
      return jsonWrap({ ok: true });
    }

    await prisma.chatMessageReaction.deleteMany({
      where: { messageId, userId: user.id },
    });

    try {
      await prisma.chatMessageReaction.create({
        data: { messageId, userId: user.id, emoji },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }

    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });
    await publishChatEvent({
      type: "reaction:update",
      organizationId: organization.id,
      conversationId: message.conversationId,
      messageId,
      reactions,
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
    console.error("POST /api/chat/messages/[id]/reactions error:", err);
    return jsonWrap({ ok: false, error: "Erro ao reagir." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);
    const { messageId } = await context.params;
    const payload = (await req.json().catch(() => null)) as { emoji?: unknown } | null;
    const emoji = parseEmoji(payload?.emoji);

    if (!emoji) {
      return jsonWrap({ ok: false, error: "INVALID_EMOJI" }, { status: 400 });
    }

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

    await prisma.chatMessageReaction.delete({
      where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
    });

    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });
    await publishChatEvent({
      type: "reaction:update",
      organizationId: organization.id,
      conversationId: message.conversationId,
      messageId,
      reactions,
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
    console.error("DELETE /api/chat/messages/[id]/reactions error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover reacao." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
