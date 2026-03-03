export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  canManageCommunity,
  parseCommunityAccessMode,
  parseCommunityTalkPolicy,
} from "@/lib/messages/communityAccess";
import { publishChatEvent } from "@/lib/chat/redis";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
} as const;
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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function _GET(req: NextRequest) {
  try {
    const { user, organization, membership } = await requireChatContext(req);

    const canManage = await canManageCommunity({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
    });
    if (!canManage) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const communities = await prisma.chatCommunity.findMany({
      where: { organizationId: organization.id },
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
            createdAt: true,
            lastMessageAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const conversationIds = communities.map((item) => item.conversationId);

    const [participantCounts, pendingCounts] = await Promise.all([
      conversationIds.length
        ? prisma.chatConversationMember.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              ...ACTIVE_MEMBER_FILTER,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      conversationIds.length
        ? prisma.chatAccessGrant.groupBy({
            by: ["conversationId"],
            where: {
              kind: "COMMUNITY_JOIN_REQUEST",
              status: "PENDING",
              conversationId: { in: conversationIds },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const participantMap = new Map<string, number>(
      participantCounts
        .map((row) => [row.conversationId, row._count._all] as const)
        .filter((entry): entry is readonly [string, number] => Boolean(entry[0])),
    );
    const pendingMap = new Map<string, number>(
      pendingCounts
        .map((row) => [row.conversationId, row._count._all] as const)
        .filter((entry): entry is readonly [string, number] => Boolean(entry[0])),
    );

    const items = communities.map((community) => ({
      conversationId: community.conversationId,
      title: community.title,
      description: community.description,
      coverImageUrl: community.coverImageUrl,
      talkPolicy: community.talkPolicy,
      accessMode: community.accessMode,
      participantsCount: participantMap.get(community.conversationId) ?? 0,
      pendingRequestsCount: pendingMap.get(community.conversationId) ?? 0,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
      lastMessageAt:
        community.conversation.lastMessageAt?.toISOString() ??
        community.conversation.createdAt.toISOString(),
    }));

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/communities error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const { user, organization, membership } = await requireChatContext(req);

    const canManage = await canManageCommunity({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
    });
    if (!canManage) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as {
      title?: unknown;
      description?: unknown;
      coverImageUrl?: unknown;
      talkPolicy?: unknown;
      accessMode?: unknown;
      adminIds?: unknown;
      memberIds?: unknown;
    } | null;

    const title = normalizeText(payload?.title);
    if (title.length < COMMUNITY_TITLE_MIN) {
      return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }
    if (title.length > COMMUNITY_TITLE_MAX) {
      return jsonWrap({ ok: false, error: "TITLE_TOO_LONG" }, { status: 400 });
    }

    const description = normalizeText(payload?.description);
    if (description.length > COMMUNITY_DESCRIPTION_MAX) {
      return jsonWrap({ ok: false, error: "DESCRIPTION_TOO_LONG" }, { status: 400 });
    }

    const coverImageUrl = normalizeText(payload?.coverImageUrl);
    if (coverImageUrl.length > COMMUNITY_COVER_URL_MAX || (coverImageUrl && !isValidHttpUrl(coverImageUrl))) {
      return jsonWrap({ ok: false, error: "INVALID_COVER_IMAGE_URL" }, { status: 400 });
    }

    const talkPolicy = parseCommunityTalkPolicy(payload?.talkPolicy);
    const accessMode = parseCommunityAccessMode(payload?.accessMode);
    if (!talkPolicy || !accessMode) {
      return jsonWrap({ ok: false, error: "INVALID_POLICY" }, { status: 400 });
    }

    const adminIds = normalizeUserIds(payload?.adminIds);
    const memberIds = normalizeUserIds(payload?.memberIds);

    const uniqueTeamMembers = Array.from(new Set([user.id, ...adminIds, ...memberIds]));
    const effectiveMembers = await listEffectiveOrganizationMembers({
      organizationId: organization.id,
      userIds: uniqueTeamMembers,
    });
    if (effectiveMembers.length !== uniqueTeamMembers.length) {
      return jsonWrap({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
    }

    const adminSet = new Set<string>([user.id, ...adminIds]);

    const community = await prisma.$transaction(async (tx) => {
      const conversationId = crypto.randomUUID();
      const conversation = await tx.chatConversation.create({
        data: {
          id: conversationId,
          organizationId: organization.id,
          type: "CHANNEL",
          contextType: "ORG_COMMUNITY",
          contextId: conversationId,
          title,
          description: description || null,
          createdByUserId: user.id,
          members: {
            create: uniqueTeamMembers.map((memberId) => ({
              userId: memberId,
              organizationId: organization.id,
              role: adminSet.has(memberId) ? "ADMIN" : "MEMBER",
            })),
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const created = await tx.chatCommunity.create({
        data: {
          conversationId: conversation.id,
          organizationId: organization.id,
          title,
          description: description || null,
          coverImageUrl: coverImageUrl || null,
          talkPolicy,
          accessMode,
          createdByUserId: user.id,
        },
        select: {
          conversationId: true,
          title: true,
          description: true,
          coverImageUrl: true,
          talkPolicy: true,
          accessMode: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { community: created, conversation };
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "conversation:update",
      action: "created",
      organizationId: organization.id,
      conversationId: community.conversation.id,
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap(
      {
        ok: true,
        community: {
          ...community.community,
          createdAt: community.community.createdAt.toISOString(),
          updatedAt: community.community.updatedAt.toISOString(),
        },
        conversation: {
          ...community.conversation,
          createdAt: community.conversation.createdAt.toISOString(),
          updatedAt: community.conversation.updatedAt.toISOString(),
        },
        ...(warnings.length ? { warnings } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/communities error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
