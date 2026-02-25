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

    const { community } = await requireManagedCommunity(req, conversationId);

    const members = await prisma.chatConversationMember.findMany({
      where: { conversationId },
      select: {
        userId: true,
        role: true,
        organizationId: true,
        joinedAt: true,
        leftAt: true,
        accessRevokedAt: true,
        bannedAt: true,
        writeMutedAt: true,
        writeMutedUntil: true,
        writeMutedByUserId: true,
        followGraceEndsAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    const items = members.map((member) => ({
      userId: member.userId,
      role: member.role,
      isTeamMember: member.organizationId === community.organizationId,
      joinedAt: member.joinedAt.toISOString(),
      leftAt: member.leftAt?.toISOString() ?? null,
      accessRevokedAt: member.accessRevokedAt?.toISOString() ?? null,
      bannedAt: member.bannedAt?.toISOString() ?? null,
      writeMutedAt: member.writeMutedAt?.toISOString() ?? null,
      writeMutedUntil: member.writeMutedUntil?.toISOString() ?? null,
      writeMutedByUserId: member.writeMutedByUserId ?? null,
      followGraceEndsAt: member.followGraceEndsAt?.toISOString() ?? null,
      user: {
        id: member.user.id,
        fullName: member.user.fullName,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
      },
    }));

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/communities/[conversationId]/participants error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
