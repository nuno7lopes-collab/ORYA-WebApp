export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import {
  requireManagedCommunity,
  toDeterministicUuid,
} from "@/app/api/messages/communities/_shared";

function normalizeUserIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

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

    if (community.accessMode !== "INVITE") {
      return jsonWrap({ ok: false, error: "INVITES_REQUIRE_INVITE_MODE" }, { status: 409 });
    }

    const payload = (await req.json().catch(() => null)) as {
      userIds?: unknown;
      message?: unknown;
    } | null;

    const targetUserIds = normalizeUserIds(payload?.userIds);
    if (!targetUserIds.length) {
      return jsonWrap({ ok: false, error: "INVALID_USERS" }, { status: 400 });
    }

    const profiles = await prisma.profile.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true },
    });

    const foundSet = new Set(profiles.map((profile) => profile.id));
    const missingUsers = targetUserIds.filter((userId) => !foundSet.has(userId));

    const existingMembers = await prisma.chatConversationMember.findMany({
      where: {
        conversationId,
        userId: { in: targetUserIds },
      },
      select: {
        userId: true,
        bannedAt: true,
        leftAt: true,
        accessRevokedAt: true,
      },
    });

    const membershipByUser = new Map(existingMembers.map((member) => [member.userId, member] as const));

    const invited: string[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];

    for (const userId of targetUserIds) {
      if (!foundSet.has(userId)) {
        skipped.push({ userId, reason: "USER_NOT_FOUND" });
        continue;
      }

      const member = membershipByUser.get(userId);
      if (member?.bannedAt) {
        skipped.push({ userId, reason: "BANNED" });
        continue;
      }
      if (member && !member.leftAt && !member.accessRevokedAt) {
        skipped.push({ userId, reason: "ALREADY_MEMBER" });
        continue;
      }

      const sourceId = toDeterministicUuid(`community-invite:${conversationId}:user:${userId}`);
      const now = new Date();
      await prisma.chatAccessGrant.upsert({
        where: {
          sourceTable_sourceId: {
            sourceTable: "community_invite_manual",
            sourceId,
          },
        },
        create: {
          kind: "COMMUNITY_INVITE",
          status: "PENDING",
          contextType: "ORG_COMMUNITY",
          contextId: conversationId,
          conversationId,
          requesterId: user.id,
          targetUserId: userId,
          organizationId: organization.id,
          targetOrganizationId: organization.id,
          sourceTable: "community_invite_manual",
          sourceId,
          title: community.title,
          metadata: {
            communityTitle: community.title,
            invitedByUserId: user.id,
            message: typeof payload?.message === "string" ? payload.message.trim().slice(0, 600) : null,
          } as Prisma.InputJsonValue,
        },
        update: {
          status: "PENDING",
          requesterId: user.id,
          targetUserId: userId,
          organizationId: organization.id,
          targetOrganizationId: organization.id,
          conversationId,
          contextType: "ORG_COMMUNITY",
          contextId: conversationId,
          title: community.title,
          resolvedAt: null,
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          revokedAt: null,
          updatedAt: now,
          metadata: {
            communityTitle: community.title,
            invitedByUserId: user.id,
            message: typeof payload?.message === "string" ? payload.message.trim().slice(0, 600) : null,
          } as Prisma.InputJsonValue,
        },
      });

      invited.push(userId);
    }

    return jsonWrap({
      ok: true,
      invitedCount: invited.length,
      invitedUserIds: invited,
      skipped,
      missingUserIds: missingUsers,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/communities/[conversationId]/invites error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
