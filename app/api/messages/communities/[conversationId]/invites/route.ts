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

function normalizeUserTargets(value: unknown) {
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

function normalizeUsernameToken(value: string) {
  const trimmed = value.trim();
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return withoutAt.toLowerCase();
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

    const targetRefs = normalizeUserTargets(payload?.userIds);
    if (!targetRefs.length) {
      return jsonWrap({ ok: false, error: "INVALID_USERS" }, { status: 400 });
    }

    const usernameTargets = Array.from(
      new Set(
        targetRefs
          .map((value) => normalizeUsernameToken(value))
          .filter(Boolean),
      ),
    );
    const [profilesById, profilesByUsername] = await Promise.all([
      prisma.profile.findMany({
        where: { id: { in: targetRefs } },
        select: { id: true, username: true },
      }),
      usernameTargets.length
        ? prisma.profile.findMany({
            where: { username: { in: usernameTargets } },
            select: { id: true, username: true },
          })
        : Promise.resolve([] as Array<{ id: string; username: string | null }>),
    ]);

    const profileIdById = new Map(profilesById.map((profile) => [profile.id, profile.id]));
    const profileIdByUsername = new Map<string, string>();
    for (const profile of [...profilesById, ...profilesByUsername]) {
      const key = profile.username?.trim().toLowerCase();
      if (!key || profileIdByUsername.has(key)) continue;
      profileIdByUsername.set(key, profile.id);
    }

    const resolvedUserIds = targetRefs.map((target) => {
      const byId = profileIdById.get(target);
      if (byId) return byId;
      const byUsername = profileIdByUsername.get(normalizeUsernameToken(target));
      return byUsername ?? null;
    });
    const missingUsers = targetRefs.filter((_, index) => !resolvedUserIds[index]);
    const targetUserIds = Array.from(
      new Set(
        resolvedUserIds.filter((value): value is string => Boolean(value)),
      ),
    );
    if (!targetUserIds.length) {
      return jsonWrap({
        ok: true,
        invitedCount: 0,
        invitedUserIds: [],
        skipped: missingUsers.map((target) => ({ userId: target, reason: "USER_NOT_FOUND" })),
        missingUserIds: missingUsers,
      });
    }

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
    const skipped: Array<{ userId: string; reason: string }> = missingUsers.map((target) => ({
      userId: target,
      reason: "USER_NOT_FOUND",
    }));

    for (const userId of targetUserIds) {
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
