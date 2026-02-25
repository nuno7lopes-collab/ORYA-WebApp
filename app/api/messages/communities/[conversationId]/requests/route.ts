export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import { requireManagedCommunity } from "@/app/api/messages/communities/_shared";

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> | { conversationId: string } },
) {
  try {
    const params = await context.params;
    const conversationId = params.conversationId?.trim();
    if (!conversationId) {
      return jsonWrap({ ok: false, error: "INVALID_CONVERSATION" }, { status: 400 });
    }

    await requireManagedCommunity(req, conversationId);

    const grants = await prisma.chatAccessGrant.findMany({
      where: {
        kind: "COMMUNITY_JOIN_REQUEST",
        status: "PENDING",
        conversationId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        requesterId: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const requesterIds = Array.from(
      new Set(grants.map((grant) => grant.requesterId).filter((id): id is string => Boolean(id))),
    );

    const profiles = requesterIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: requesterIds } },
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        })
      : [];

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile] as const));

    const items = grants.map((grant) => {
      const requester = grant.requesterId ? profileMap.get(grant.requesterId) : null;
      return {
        id: grant.id,
        requesterId: grant.requesterId,
        createdAt: grant.createdAt.toISOString(),
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        requester: requester
          ? {
              id: requester.id,
              fullName: requester.fullName,
              username: requester.username,
              avatarUrl: requester.avatarUrl,
            }
          : null,
      };
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/communities/[conversationId]/requests error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
