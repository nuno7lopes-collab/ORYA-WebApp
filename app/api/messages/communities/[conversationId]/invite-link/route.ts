export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import {
  buildInviteExpiryFromPreset,
  createCommunityInviteToken,
  hashCommunityInviteToken,
  parseInvitePreset,
} from "@/lib/messages/communityAccess";
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

    const { user, community } = await requireManagedCommunity(req, conversationId);

    if (community.accessMode !== "INVITE") {
      return jsonWrap({ ok: false, error: "INVITE_LINKS_REQUIRE_INVITE_MODE" }, { status: 409 });
    }

    const payload = (await req.json().catch(() => null)) as {
      preset?: unknown;
    } | null;

    const parsedPreset = parseInvitePreset(payload?.preset);
    if (!parsedPreset.ok) {
      return jsonWrap({ ok: false, error: parsedPreset.error }, { status: 400 });
    }

    const expiresAt = buildInviteExpiryFromPreset(parsedPreset.ms);
    const token = createCommunityInviteToken();
    const tokenHash = hashCommunityInviteToken(token);

    const now = new Date();
    const link = await prisma.$transaction(async (tx) => {
      await tx.chatCommunityInviteLink.updateMany({
        where: {
          conversationId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return tx.chatCommunityInviteLink.create({
        data: {
          conversationId,
          tokenHash,
          createdByUserId: user.id,
          expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    });

    return jsonWrap({
      ok: true,
      inviteLink: {
        id: link.id,
        token,
        invitePath: `/messages/community-invite/${encodeURIComponent(token)}`,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        createdAt: link.createdAt.toISOString(),
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/communities/[conversationId]/invite-link error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
