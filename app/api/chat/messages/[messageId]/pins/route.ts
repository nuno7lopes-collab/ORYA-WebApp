export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { OrganizationMemberRole } from "@prisma/client";
import { publishChatEvent } from "@/lib/chat/redis";

function isAdminRole(role: OrganizationMemberRole) {
  return (
    role === OrganizationMemberRole.OWNER ||
    role === OrganizationMemberRole.CO_OWNER ||
    role === OrganizationMemberRole.ADMIN
  );
}

export async function POST(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
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
      return NextResponse.json({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/messages/[id]/pins error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao fixar mensagem." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return NextResponse.json({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
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
      return NextResponse.json({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    const pin = await prisma.chatMessagePin.findFirst({
      where: { messageId },
      select: { id: true, pinnedBy: true },
    });

    if (!pin) {
      return NextResponse.json({ ok: true });
    }

    const canUnpin = pin.pinnedBy === user.id || (membership?.role && isAdminRole(membership.role));
    if (!canUnpin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("DELETE /api/chat/messages/[id]/pins error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover pin." }, { status: 500 });
  }
}
