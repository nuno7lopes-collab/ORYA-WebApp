export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import { publishChatEvent } from "@/lib/chat/redis";
import { requireManagedCommunity } from "@/app/api/messages/communities/_shared";

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> | { conversationId: string } },
) {
  try {
    const params = await context.params;
    const conversationId = params.conversationId?.trim();
    if (!conversationId) {
      return jsonWrap({ ok: false, error: "INVALID_CONVERSATION" }, { status: 400 });
    }

    const { user, organization, community } = await requireManagedCommunity(req, conversationId);

    const pending = await prisma.chatAccessGrant.findMany({
      where: {
        kind: "COMMUNITY_JOIN_REQUEST",
        status: "PENDING",
        conversationId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        requesterId: true,
      },
    });

    if (!pending.length) {
      return jsonWrap({ ok: true, approvedCount: 0, declinedCount: 0, total: 0 });
    }

    const now = new Date();
    let approvedCount = 0;
    let declinedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const request of pending) {
        if (!request.requesterId) {
          await tx.chatAccessGrant.update({
            where: { id: request.id },
            data: {
              status: "DECLINED",
              declinedAt: now,
              resolvedAt: now,
              resolvedByUserId: user.id,
              updatedAt: now,
            },
          });
          declinedCount += 1;
          continue;
        }

        const banned = await tx.chatConversationMember.findFirst({
          where: {
            conversationId,
            userId: request.requesterId,
            bannedAt: { not: null },
          },
          select: { userId: true },
        });

        if (banned) {
          await tx.chatAccessGrant.update({
            where: { id: request.id },
            data: {
              status: "DECLINED",
              declinedAt: now,
              resolvedAt: now,
              resolvedByUserId: user.id,
              updatedAt: now,
            },
          });
          declinedCount += 1;
          continue;
        }

        await tx.chatConversationMember.upsert({
          where: {
            conversationId_userId: {
              conversationId,
              userId: request.requesterId,
            },
          },
          update: {
            role: "MEMBER",
            organizationId: null,
            leftAt: null,
            accessRevokedAt: null,
            bannedAt: null,
            followGraceEndsAt: null,
          },
          create: {
            conversationId,
            userId: request.requesterId,
            role: "MEMBER",
            organizationId: null,
          },
        });

        await tx.chatAccessGrant.update({
          where: { id: request.id },
          data: {
            status: "ACCEPTED",
            conversationId,
            acceptedAt: now,
            resolvedAt: now,
            resolvedByUserId: user.id,
            updatedAt: now,
          },
        });

        approvedCount += 1;
      }
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "conversation:update",
      action: "updated",
      organizationId: organization.id,
      conversationId,
      conversation: {
        id: conversationId,
        contextType: "ORG_COMMUNITY",
        title: community.title,
      },
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({
      ok: true,
      approvedCount,
      declinedCount,
      total: pending.length,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/communities/[conversationId]/requests/approve-all error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
