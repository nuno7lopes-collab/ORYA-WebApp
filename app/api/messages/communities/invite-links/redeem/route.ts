export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";
import { hashCommunityInviteToken } from "@/lib/messages/communityAccess";
import { upsertCommunityConversationMember } from "@/lib/messages/communityMembership";
import { toDeterministicUuid } from "@/app/api/messages/communities/_shared";

async function _POST(req: NextRequest) {
  try {
    const mobileGate = enforceB2CMobileOnly(req);
    if (mobileGate) return mobileGate;
    const scope = getMessagesScope(req);
    if (scope !== "b2c") {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof payload?.token === "string" ? payload.token.trim() : "";
    if (!token) {
      return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const tokenHash = hashCommunityInviteToken(token);
    const link = await prisma.chatCommunityInviteLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        conversationId: true,
        expiresAt: true,
        revokedAt: true,
        conversation: {
          select: {
            conversationId: true,
            title: true,
            accessMode: true,
            organizationId: true,
          },
        },
      },
    });

    if (!link || !link.conversation) {
      return jsonWrap({ ok: false, error: "INVITE_LINK_INVALID" }, { status: 404 });
    }

    if (link.revokedAt) {
      return jsonWrap({ ok: false, error: "INVITE_LINK_REVOKED" }, { status: 410 });
    }

    if (link.expiresAt && link.expiresAt <= new Date()) {
      return jsonWrap({ ok: false, error: "INVITE_LINK_EXPIRED" }, { status: 410 });
    }

    if (link.conversation.accessMode !== "INVITE") {
      return jsonWrap({ ok: false, error: "INVITE_MODE_DISABLED" }, { status: 409 });
    }

    const bannedMembership = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId: link.conversationId,
        userId: user.id,
        bannedAt: { not: null },
      },
      select: { userId: true },
    });
    if (bannedMembership) {
      return jsonWrap({ ok: false, error: "BANNED" }, { status: 403 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await upsertCommunityConversationMember({
        tx,
        conversationId: link.conversationId,
        userId: user.id,
      });

      const sourceId = toDeterministicUuid(`community-invite-link:${link.id}:user:${user.id}`);
      await tx.chatAccessGrant.upsert({
        where: {
          sourceTable_sourceId: {
            sourceTable: "community_invite_link_redeem",
            sourceId,
          },
        },
        create: {
          kind: "COMMUNITY_INVITE",
          status: "ACCEPTED",
          contextType: "ORG_COMMUNITY",
          contextId: link.conversationId,
          conversationId: link.conversationId,
          requesterId: null,
          targetUserId: user.id,
          organizationId: link.conversation.organizationId,
          targetOrganizationId: link.conversation.organizationId,
          sourceTable: "community_invite_link_redeem",
          sourceId,
          title: link.conversation.title,
          acceptedAt: now,
          resolvedAt: now,
          metadata: {
            inviteLinkId: link.id,
            redeemedByUserId: user.id,
          } as Prisma.InputJsonValue,
        },
        update: {
          status: "ACCEPTED",
          contextType: "ORG_COMMUNITY",
          contextId: link.conversationId,
          conversationId: link.conversationId,
          targetUserId: user.id,
          organizationId: link.conversation.organizationId,
          targetOrganizationId: link.conversation.organizationId,
          acceptedAt: now,
          resolvedAt: now,
          declinedAt: null,
          revokedAt: null,
          cancelledAt: null,
          updatedAt: now,
          metadata: {
            inviteLinkId: link.id,
            redeemedByUserId: user.id,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return jsonWrap({
      ok: true,
      contextType: "ORG_COMMUNITY",
      conversationId: link.conversationId,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/messages/communities/invite-links/redeem error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
