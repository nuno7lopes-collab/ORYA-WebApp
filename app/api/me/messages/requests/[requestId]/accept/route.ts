export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { Prisma } from "@prisma/client";

function buildDmContextId(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

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
      select: { id: true, requesterId: true },
    });

    if (!request) {
      return jsonWrap({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }

    const dmContextId = buildDmContextId(user.id, request.requesterId);
    const existing = await prisma.chatConversation.findFirst({
      where: {
        organizationId: null,
        contextType: "USER_DM",
        contextId: dmContextId,
      },
      select: { id: true },
    });

    let conversation = existing;
    if (!conversation) {
      try {
        conversation = await prisma.chatConversation.create({
          data: {
            organizationId: null,
            type: "DIRECT",
            contextType: "USER_DM",
            contextId: dmContextId,
            createdByUserId: request.requesterId,
            members: {
              create: [
                { userId: request.requesterId, role: "MEMBER" },
                { userId: user.id, role: "MEMBER" },
              ],
            },
          },
          select: { id: true },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        const existingAfterConflict = await prisma.chatConversation.findFirst({
          where: { organizationId: null, contextType: "USER_DM", contextId: dmContextId },
          select: { id: true },
        });
        if (!existingAfterConflict) {
          throw err;
        }
        conversation = existingAfterConflict;
      }
    }

    await prisma.chatConversationRequest.update({
      where: { id: request.id },
      data: {
        status: "ACCEPTED",
        resolvedAt: new Date(),
        conversationId: conversation.id,
        updatedAt: new Date(),
      },
    });

    return jsonWrap({ ok: true, conversationId: conversation.id });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/requests/accept] error", err);
    return jsonWrap({ error: "Erro ao aceitar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
