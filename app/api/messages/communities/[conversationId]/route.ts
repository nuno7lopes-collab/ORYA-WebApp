export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import { publishChatEvent } from "@/lib/chat/redis";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import { parseCommunityAccessMode, parseCommunityTalkPolicy } from "@/lib/messages/communityAccess";
import { ACTIVE_MEMBER_FILTER, requireManagedCommunity } from "@/app/api/messages/communities/_shared";

const COMMUNITY_TITLE_MIN = 2;
const COMMUNITY_TITLE_MAX = 120;
const COMMUNITY_DESCRIPTION_MAX = 1000;
const COMMUNITY_COVER_URL_MAX = 2048;

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

function normalizeOptionalText(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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

    const [participants, pendingRequests] = await Promise.all([
      prisma.chatConversationMember.groupBy({
        by: ["role"],
        where: {
          conversationId,
          ...ACTIVE_MEMBER_FILTER,
        },
        _count: { _all: true },
      }),
      prisma.chatAccessGrant.count({
        where: {
          kind: "COMMUNITY_JOIN_REQUEST",
          status: "PENDING",
          conversationId,
        },
      }),
    ]);

    const membersCount = participants.reduce((sum, row) => sum + row._count._all, 0);
    const adminsCount =
      participants.find((row) => row.role === "ADMIN")?._count._all ?? 0;

    return jsonWrap({
      ok: true,
      community: {
        conversationId: community.conversationId,
        title: community.title,
        description: community.description,
        coverImageUrl: community.coverImageUrl,
        talkPolicy: community.talkPolicy,
        accessMode: community.accessMode,
        participantsCount: membersCount,
        adminsCount,
        pendingRequestsCount: pendingRequests,
        createdAt: community.createdAt.toISOString(),
        updatedAt: community.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/communities/[conversationId] error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _PATCH(
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

    const payload = (await req.json().catch(() => null)) as {
      title?: unknown;
      description?: unknown;
      coverImageUrl?: unknown;
      talkPolicy?: unknown;
      accessMode?: unknown;
      adminIds?: unknown;
      memberIds?: unknown;
    } | null;

    const nextTitle = normalizeOptionalText(payload?.title);
    if (nextTitle !== null && nextTitle.length > 0 && nextTitle.length < COMMUNITY_TITLE_MIN) {
      return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }
    if (nextTitle !== null && nextTitle.length > COMMUNITY_TITLE_MAX) {
      return jsonWrap({ ok: false, error: "TITLE_TOO_LONG" }, { status: 400 });
    }

    const nextDescription = normalizeOptionalText(payload?.description);
    if (nextDescription !== null && nextDescription.length > COMMUNITY_DESCRIPTION_MAX) {
      return jsonWrap({ ok: false, error: "DESCRIPTION_TOO_LONG" }, { status: 400 });
    }

    const nextCoverImageUrl = normalizeOptionalText(payload?.coverImageUrl);
    if (
      nextCoverImageUrl !== null &&
      (nextCoverImageUrl.length > COMMUNITY_COVER_URL_MAX ||
        (nextCoverImageUrl.length > 0 && !isValidHttpUrl(nextCoverImageUrl)))
    ) {
      return jsonWrap({ ok: false, error: "INVALID_COVER_IMAGE_URL" }, { status: 400 });
    }

    const talkPolicyProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, "talkPolicy");
    const accessModeProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, "accessMode");

    const parsedTalkPolicy = talkPolicyProvided ? parseCommunityTalkPolicy(payload?.talkPolicy) : null;
    const parsedAccessMode = accessModeProvided ? parseCommunityAccessMode(payload?.accessMode) : null;

    if (talkPolicyProvided && !parsedTalkPolicy) {
      return jsonWrap({ ok: false, error: "INVALID_TALK_POLICY" }, { status: 400 });
    }
    if (accessModeProvided && !parsedAccessMode) {
      return jsonWrap({ ok: false, error: "INVALID_ACCESS_MODE" }, { status: 400 });
    }

    const rolesProvided =
      Object.prototype.hasOwnProperty.call(payload ?? {}, "adminIds") ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, "memberIds");

    const adminIds = normalizeUserIds(payload?.adminIds);
    const memberIds = normalizeUserIds(payload?.memberIds);

    const hasMetadataChange =
      nextTitle !== null ||
      nextDescription !== null ||
      nextCoverImageUrl !== null ||
      talkPolicyProvided ||
      accessModeProvided;

    if (!hasMetadataChange && !rolesProvided) {
      return jsonWrap({ ok: false, error: "NO_CHANGES" }, { status: 400 });
    }

    const finalTeamUserIds = rolesProvided
      ? Array.from(new Set([user.id, ...adminIds, ...memberIds]))
      : [];
    const finalAdminSet = new Set<string>(rolesProvided ? [user.id, ...adminIds] : []);

    if (rolesProvided) {
      const effectiveMembers = await listEffectiveOrganizationMembers({
        organizationId: organization.id,
        userIds: finalTeamUserIds,
      });
      if (effectiveMembers.length !== finalTeamUserIds.length) {
        return jsonWrap({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
      }
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      if (hasMetadataChange) {
        await tx.chatCommunity.update({
          where: { conversationId },
          data: {
            title: nextTitle === null ? undefined : nextTitle || community.title,
            description: nextDescription === null ? undefined : nextDescription || null,
            coverImageUrl: nextCoverImageUrl === null ? undefined : nextCoverImageUrl || null,
            talkPolicy: talkPolicyProvided ? parsedTalkPolicy ?? undefined : undefined,
            accessMode: accessModeProvided ? parsedAccessMode ?? undefined : undefined,
          },
        });

        await tx.chatConversation.update({
          where: { id: conversationId },
          data: {
            title: nextTitle === null ? undefined : nextTitle || community.title,
            description: nextDescription === null ? undefined : nextDescription || null,
          },
        });
      }

      if (rolesProvided) {
        const currentTeamMembers = await tx.chatConversationMember.findMany({
          where: {
            conversationId,
            organizationId: organization.id,
          },
          select: {
            userId: true,
          },
        });

        const toDeactivate = currentTeamMembers
          .map((entry) => entry.userId)
          .filter((memberUserId) => !finalTeamUserIds.includes(memberUserId));

        if (toDeactivate.length) {
          await tx.chatConversationMember.updateMany({
            where: {
              conversationId,
              userId: { in: toDeactivate },
            },
            data: {
              leftAt: now,
              accessRevokedAt: now,
            },
          });
        }

        for (const memberUserId of finalTeamUserIds) {
          await tx.chatConversationMember.upsert({
            where: {
              conversationId_userId: {
                conversationId,
                userId: memberUserId,
              },
            },
            update: {
              role: finalAdminSet.has(memberUserId) ? "ADMIN" : "MEMBER",
              organizationId: organization.id,
              leftAt: null,
              accessRevokedAt: null,
              bannedAt: null,
            },
            create: {
              conversationId,
              userId: memberUserId,
              organizationId: organization.id,
              role: finalAdminSet.has(memberUserId) ? "ADMIN" : "MEMBER",
            },
          });
        }
      }

      return tx.chatCommunity.findUnique({
        where: { conversationId },
        select: {
          conversationId: true,
          title: true,
          description: true,
          coverImageUrl: true,
          talkPolicy: true,
          accessMode: true,
          createdAt: true,
          updatedAt: true,
          conversation: {
            select: {
              id: true,
              title: true,
              description: true,
              updatedAt: true,
            },
          },
        },
      });
    });

    if (!updated) {
      return jsonWrap({ ok: false, error: "COMMUNITY_NOT_FOUND" }, { status: 404 });
    }

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "conversation:update",
      action: "updated",
      organizationId: organization.id,
      conversationId,
      conversation: {
        id: updated.conversation.id,
        title: updated.conversation.title,
        description: updated.conversation.description,
        contextType: "ORG_COMMUNITY",
      },
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({
      ok: true,
      community: {
        conversationId: updated.conversationId,
        title: updated.title,
        description: updated.description,
        coverImageUrl: updated.coverImageUrl,
        talkPolicy: updated.talkPolicy,
        accessMode: updated.accessMode,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/messages/communities/[conversationId] error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
