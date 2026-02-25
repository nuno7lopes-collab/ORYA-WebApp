export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ChatConversationContextType } from "@prisma/client";

const B2C_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.EVENT,
  ChatConversationContextType.USER_DM,
  ChatConversationContextType.USER_GROUP,
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.BOOKING,
  ChatConversationContextType.SERVICE,
  ChatConversationContextType.ORG_COMMUNITY,
];
const LEVELS = new Set(["ALL", "MENTIONS_ONLY", "OFF"]);
const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
} as const;

async function _PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const conversationId = context.params.conversationId;
    const payload = (await req.json().catch(() => null)) as { notifLevel?: unknown; mutedUntil?: unknown } | null;

    const notifLevel = typeof payload?.notifLevel === "string" ? payload.notifLevel.trim().toUpperCase() : null;
    const mutedUntilRaw = payload?.mutedUntil;
    const mutedUntil =
      typeof mutedUntilRaw === "string" && mutedUntilRaw.length > 0 ? new Date(mutedUntilRaw) : null;

    if (notifLevel && !LEVELS.has(notifLevel)) {
      return jsonWrap({ error: "INVALID_LEVEL" }, { status: 400 });
    }
    if (mutedUntil && Number.isNaN(mutedUntil.getTime())) {
      return jsonWrap({ error: "INVALID_MUTE" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        ...ACTIVE_MEMBER_FILTER,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      select: {
        conversationId: true,
        userId: true,
        conversation: {
          select: {
            contextType: true,
            members: {
              where: ACTIVE_MEMBER_FILTER,
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!member) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (member.conversation.contextType === ChatConversationContextType.USER_DM) {
      const peerId = member.conversation.members.find((entry) => entry.userId !== user.id)?.userId ?? null;
      if (peerId) {
        const block = await prisma.chatUserBlock.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: peerId },
              { blockerId: peerId, blockedId: user.id },
            ],
          },
          select: { id: true },
        });
        if (block) {
          return jsonWrap({ error: "CHAT_BLOCKED" }, { status: 403 });
        }
      }
    }

    const updated = await prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        notifLevel: notifLevel ? (notifLevel as "ALL" | "MENTIONS_ONLY" | "OFF") : undefined,
        mutedUntil: mutedUntilRaw === null ? null : mutedUntil ?? undefined,
      },
      select: { notifLevel: true, mutedUntil: true },
    });

    return jsonWrap({ ok: true, notifLevel: updated.notifLevel, mutedUntil: updated.mutedUntil });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/conversations/notifications] error", err);
    return jsonWrap({ error: "Erro ao atualizar notificações." }, { status: 500 });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
