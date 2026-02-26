export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { ChatAccessGrantKind, ChatAccessGrantStatus, ChatConversationContextType, Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import { requireChatContext, ChatContextError } from "@/lib/chat/context";
import { publishChatEvent } from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { hashCommunityInviteToken, isUserFollowingOrganization } from "@/lib/messages/communityAccess";
import { upsertCommunityConversationMember } from "@/lib/messages/communityMembership";
import { shouldEnforceMobileClientForResolve } from "@/lib/messages/resolvePolicy";
import {
  enforceMobileClientRequest,
  getMessagesScope,
} from "@/app/api/messages/_scope";

type ResolvePayload = {
  contextType?: unknown;
  contextId?: unknown;
  eventId?: unknown;
  bookingId?: unknown;
  serviceId?: unknown;
  targetUserId?: unknown;
  targetOrganizationId?: unknown;
  title?: unknown;
  memberIds?: unknown;
  inviteToken?: unknown;
};

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildDmContextId(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

function toDeterministicUuid(input: string) {
  const bytes = crypto.createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  bytes[12] = "4";
  const variant = parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapLegacyStatus(status: string | null | undefined): ChatAccessGrantStatus {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "APPROVED") return "ACCEPTED";
  if (normalized === "REJECTED") return "DECLINED";
  if (normalized === "CANCELED") return "CANCELLED";
  if (
    ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "REVOKED", "AUTO_ACCEPTED"].includes(
      normalized,
    )
  ) {
    return normalized as ChatAccessGrantStatus;
  }
  return "PENDING";
}

async function hasMutualFollow(userId: string, targetUserId: string) {
  const [a, b] = await Promise.all([
    prisma.follows.findFirst({ where: { follower_id: userId, following_id: targetUserId }, select: { follower_id: true } }),
    prisma.follows.findFirst({ where: { follower_id: targetUserId, following_id: userId }, select: { follower_id: true } }),
  ]);
  return Boolean(a && b);
}

async function ensureDmConversation(userId: string, targetUserId: string, createdByUserId: string) {
  const contextId = buildDmContextId(userId, targetUserId);
  const existing = await prisma.chatConversation.findFirst({
    where: {
      organizationId: null,
      contextType: ChatConversationContextType.USER_DM,
      contextId,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.chatConversation.create({
      data: {
        organizationId: null,
        type: "DIRECT",
        contextType: ChatConversationContextType.USER_DM,
        contextId,
        createdByUserId,
        members: {
          create: [
            { userId, role: "MEMBER" },
            { userId: targetUserId, role: "MEMBER" },
          ],
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
    const afterConflict = await prisma.chatConversation.findFirst({
      where: {
        organizationId: null,
        contextType: ChatConversationContextType.USER_DM,
        contextId,
      },
      select: { id: true },
    });
    if (!afterConflict) throw err;
    return afterConflict.id;
  }
}

async function upsertGrantByCanonicalKey(params: {
  key: string;
  kind: ChatAccessGrantKind;
  status: ChatAccessGrantStatus;
  contextType: ChatConversationContextType;
  contextId?: string | null;
  requesterId?: string | null;
  targetUserId?: string | null;
  targetOrganizationId?: number | null;
  organizationId?: number | null;
  eventId?: number | null;
  entitlementId?: string | null;
  threadId?: string | null;
  title?: string | null;
  conversationId?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const sourceId = toDeterministicUuid(params.key);
  const now = new Date();

  return prisma.chatAccessGrant.upsert({
    where: {
      sourceTable_sourceId: {
        sourceTable: "messages_resolve",
        sourceId,
      },
    },
    create: {
      kind: params.kind,
      status: params.status,
      contextType: params.contextType,
      contextId: params.contextId ?? null,
      requesterId: params.requesterId ?? null,
      targetUserId: params.targetUserId ?? null,
      targetOrganizationId: params.targetOrganizationId ?? null,
      organizationId: params.organizationId ?? null,
      eventId: params.eventId ?? null,
      entitlementId: params.entitlementId ?? null,
      threadId: params.threadId ?? null,
      title: params.title ?? null,
      conversationId: params.conversationId ?? null,
      sourceTable: "messages_resolve",
      sourceId,
      expiresAt: params.expiresAt ?? null,
      resolvedAt: params.status === "PENDING" ? null : now,
      acceptedAt: params.status === "ACCEPTED" || params.status === "AUTO_ACCEPTED" ? now : null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      status: params.status,
      contextId: params.contextId ?? null,
      requesterId: params.requesterId ?? null,
      targetUserId: params.targetUserId ?? null,
      targetOrganizationId: params.targetOrganizationId ?? null,
      organizationId: params.organizationId ?? null,
      eventId: params.eventId ?? null,
      entitlementId: params.entitlementId ?? null,
      threadId: params.threadId ?? null,
      title: params.title ?? null,
      conversationId: params.conversationId ?? null,
      expiresAt: params.expiresAt ?? null,
      resolvedAt: params.status === "PENDING" ? null : now,
      acceptedAt:
        params.status === "ACCEPTED" || params.status === "AUTO_ACCEPTED" ? now : undefined,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      updatedAt: now,
    },
    select: { id: true, status: true, createdAt: true, conversationId: true },
  });
}

function computeEventExpiry(endsAt?: Date | null, startsAt?: Date | null) {
  const base = endsAt ?? startsAt ?? null;
  if (!base) return null;
  return new Date(base.getTime() + 24 * 60 * 60 * 1000);
}

async function ensureEventConversation(eventId: number, fallbackConversationId: string | null = null) {
  const byContext = await prisma.chatConversation.findFirst({
    where: { contextType: "EVENT", contextId: String(eventId) },
    select: { id: true },
  });
  if (byContext?.id) return byContext.id;

  if (fallbackConversationId) {
    const byId = await prisma.chatConversation.findUnique({
      where: { id: fallbackConversationId },
      select: { id: true },
    });
    if (byId?.id) return byId.id;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true, startsAt: true, endsAt: true },
  });
  if (!event || !event.organizationId) return null;

  try {
    const conversation = await prisma.chatConversation.create({
      data: {
        organizationId: event.organizationId,
        type: "CHANNEL",
        contextType: "EVENT",
        contextId: String(event.id),
        title: null,
        openAt: event.startsAt,
        readOnlyAt: event.endsAt ? new Date(event.endsAt.getTime() + 24 * 60 * 60 * 1000) : null,
        closeAt: event.endsAt ? new Date(event.endsAt.getTime() + 24 * 60 * 60 * 1000) : null,
      },
      select: { id: true },
    });
    return conversation.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const existing = await prisma.chatConversation.findFirst({
      where: { contextType: "EVENT", contextId: String(eventId) },
      select: { id: true },
    });
    return existing?.id ?? null;
  }
}

async function resolveEventGrantForUser(eventId: number, userId: string, email: string | null) {
  const identityIds = await getUserIdentityIds(userId);
  const ownerClauses = buildEntitlementOwnerClauses({ userId, identityIds, email });
  if (!ownerClauses.length) return null;

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      eventId,
      status: "ACTIVE",
      OR: ownerClauses,
      checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!entitlement) return null;

  const existing = await prisma.chatAccessGrant.findFirst({
    where: {
      kind: "EVENT_INVITE",
      eventId,
      entitlementId: entitlement.id,
      OR: [{ targetUserId: userId }, { targetUserId: null }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      conversationId: true,
      threadId: true,
      expiresAt: true,
      entitlementId: true,
      targetUserId: true,
    },
  });

  if (existing) {
    if (!existing.targetUserId) {
      await prisma.chatAccessGrant.update({
        where: { id: existing.id },
        data: { targetUserId: userId, updatedAt: new Date() },
      });
    }
    return existing;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });
  const expiresAt = computeEventExpiry(event?.endsAt ?? null, event?.startsAt ?? null);
  if (!expiresAt || expiresAt <= new Date()) {
    return null;
  }

  const grant = await upsertGrantByCanonicalKey({
    key: `event:${eventId}:entitlement:${entitlement.id}`,
    kind: "EVENT_INVITE",
    status: "PENDING",
    contextType: "EVENT",
    contextId: String(eventId),
    targetUserId: userId,
    eventId,
    entitlementId: entitlement.id,
    expiresAt,
    metadata: { canonical: true },
  });

  return {
    id: grant.id,
    status: grant.status,
    conversationId: grant.conversationId,
    threadId: null,
    expiresAt,
    entitlementId: entitlement.id,
  };
}

async function _POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as ResolvePayload | null;
    const contextTypeRaw = typeof payload?.contextType === "string" ? payload.contextType.trim().toUpperCase() : "";
    const scope = getMessagesScope(req);

    if (!contextTypeRaw) {
      return jsonWrap({ ok: false, error: "INVALID_CONTEXT" }, { status: 400 });
    }

    if (
      shouldEnforceMobileClientForResolve({
        scope,
        contextTypeRaw,
      })
    ) {
      const mobileGate = enforceMobileClientRequest(req);
      if (mobileGate) return mobileGate;
    }

    if (contextTypeRaw === "ORG_CHANNEL") {
      const { user, organization, membership } = await requireChatContext(req);

      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      const memberIds = Array.isArray(payload?.memberIds)
        ? payload.memberIds.filter((id): id is string => typeof id === "string")
        : [];

      if (title.length < 2) {
        return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
      }

      const uniqueMembers = Array.from(new Set([user.id, ...memberIds]));
      const memberships = await listEffectiveOrganizationMembers({
        organizationId: organization.id,
        userIds: uniqueMembers,
      });
      if (memberships.length !== uniqueMembers.length) {
        return jsonWrap({ ok: false, error: "NOT_IN_ORGANIZATION" }, { status: 400 });
      }

      const adminRoles = new Set(["OWNER", "CO_OWNER", "ADMIN"]);
      const isAdmin = membership?.role ? adminRoles.has(membership.role) : false;

      if (!isAdmin) {
        const grant = await upsertGrantByCanonicalKey({
          key: `org-channel:${organization.id}:requester:${user.id}:title:${title.toLowerCase()}`,
          kind: "CHANNEL_CREATE_REQUEST",
          status: "PENDING",
          contextType: "ORG_CHANNEL",
          requesterId: user.id,
          targetOrganizationId: organization.id,
          organizationId: organization.id,
          title,
          metadata: { requestedMembers: uniqueMembers },
        });

        return jsonWrap(
          {
            ok: true,
            pending: true,
            requestId: grant.id,
            grantId: grant.id,
            grantStatus: grant.status,
          },
          { status: 202 },
        );
      }

      const conversation = await prisma.chatConversation.create({
        data: {
          organizationId: organization.id,
          type: "CHANNEL",
          contextType: "ORG_CHANNEL",
          title,
          createdByUserId: user.id,
          members: {
            create: uniqueMembers.map((memberId) => ({
              userId: memberId,
              role: memberId === user.id ? "ADMIN" : "MEMBER",
              organizationId: organization.id,
            })),
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
          },
        },
      });

      const warnings: string[] = [];
      const published = await publishChatEvent({
        type: "conversation:update",
        action: "created",
        organizationId: organization.id,
        conversationId: conversation.id,
        conversation,
      });
      if (!published) {
        warnings.push("REALTIME_DEGRADED");
      }

      return jsonWrap(
        { ok: true, conversation, ...(warnings.length ? { warnings } : {}) },
        { status: 201 }
      );
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    if (contextTypeRaw === "ORG_COMMUNITY") {
      const conversationIdRaw =
        typeof payload?.contextId === "string"
          ? payload.contextId.trim()
          : typeof payload?.contextId === "number"
            ? String(payload.contextId)
            : "";
      if (!conversationIdRaw) {
        return jsonWrap({ ok: false, error: "INVALID_COMMUNITY" }, { status: 400 });
      }

      const community = await prisma.chatCommunity.findUnique({
        where: { conversationId: conversationIdRaw },
        select: {
          conversationId: true,
          organizationId: true,
          title: true,
          accessMode: true,
        },
      });
      if (!community) {
        return jsonWrap({ ok: false, error: "COMMUNITY_NOT_FOUND" }, { status: 404 });
      }

      const bannedMembership = await prisma.chatConversationMember.findFirst({
        where: {
          conversationId: community.conversationId,
          userId: user.id,
          bannedAt: { not: null },
        },
        select: { userId: true },
      });
      if (bannedMembership) {
        return jsonWrap({ ok: false, error: "BANNED" }, { status: 403 });
      }

      const joinConversation = async () => {
        await upsertCommunityConversationMember({
          tx: prisma,
          conversationId: community.conversationId,
          userId: user.id,
        });

        return jsonWrap({
          ok: true,
          contextType: "ORG_COMMUNITY",
          conversationId: community.conversationId,
        });
      };

      const activeMembership = await prisma.chatConversationMember.findFirst({
        where: {
          conversationId: community.conversationId,
          userId: user.id,
          leftAt: null,
          accessRevokedAt: null,
          bannedAt: null,
        },
        select: { userId: true },
      });
      if (activeMembership) {
        return jsonWrap({
          ok: true,
          contextType: "ORG_COMMUNITY",
          conversationId: community.conversationId,
        });
      }

      if (community.accessMode === "PUBLIC") {
        return joinConversation();
      }

      if (community.accessMode === "FOLLOWERS") {
        const isFollowing = await isUserFollowingOrganization({
          userId: user.id,
          organizationId: community.organizationId,
        });
        if (!isFollowing) {
          return jsonWrap({ ok: false, error: "FOLLOW_REQUIRED" }, { status: 403 });
        }
        return joinConversation();
      }

      if (community.accessMode === "APPROVAL") {
        const accepted = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "COMMUNITY_JOIN_REQUEST",
            status: { in: ["ACCEPTED", "AUTO_ACCEPTED"] },
            requesterId: user.id,
            conversationId: community.conversationId,
          },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (accepted) {
          return joinConversation();
        }

        const existingPending = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "COMMUNITY_JOIN_REQUEST",
            status: "PENDING",
            requesterId: user.id,
            conversationId: community.conversationId,
          },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (existingPending) {
          return jsonWrap({
            ok: true,
            contextType: "ORG_COMMUNITY",
            request: {
              id: existingPending.id,
              status: existingPending.status,
              createdAt: existingPending.createdAt.toISOString(),
            },
            grantId: existingPending.id,
            grantStatus: existingPending.status,
            requiresApproval: true,
          });
        }

        const grant = await upsertGrantByCanonicalKey({
          key: `community-join:${community.conversationId}:requester:${user.id}`,
          kind: "COMMUNITY_JOIN_REQUEST",
          status: "PENDING",
          contextType: "ORG_COMMUNITY",
          contextId: community.conversationId,
          conversationId: community.conversationId,
          requesterId: user.id,
          organizationId: community.organizationId,
          targetOrganizationId: community.organizationId,
          title: community.title,
          metadata: { canonical: true },
        });

        return jsonWrap({
          ok: true,
          contextType: "ORG_COMMUNITY",
          request: {
            id: grant.id,
            status: grant.status,
            createdAt: grant.createdAt.toISOString(),
          },
          grantId: grant.id,
          grantStatus: grant.status,
          requiresApproval: true,
        });
      }

      if (community.accessMode === "INVITE") {
        const acceptedInvite = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "COMMUNITY_INVITE",
            status: { in: ["ACCEPTED", "AUTO_ACCEPTED"] },
            targetUserId: user.id,
            conversationId: community.conversationId,
          },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        });
        if (acceptedInvite) {
          return joinConversation();
        }

        const rawInviteToken =
          typeof payload?.inviteToken === "string" ? payload.inviteToken.trim() : "";
        if (rawInviteToken) {
          const tokenHash = hashCommunityInviteToken(rawInviteToken);
          const link = await prisma.chatCommunityInviteLink.findFirst({
            where: {
              conversationId: community.conversationId,
              tokenHash,
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true },
          });
          if (link) {
            const linkRedeemSourceId = toDeterministicUuid(
              `community-invite-link:${link.id}:user:${user.id}`,
            );
            const now = new Date();

            await prisma.$transaction(async (tx) => {
              await tx.chatAccessGrant.upsert({
                where: {
                  sourceTable_sourceId: {
                    sourceTable: "community_invite_link_redeem",
                    sourceId: linkRedeemSourceId,
                  },
                },
                create: {
                  kind: "COMMUNITY_INVITE",
                  status: "ACCEPTED",
                  contextType: "ORG_COMMUNITY",
                  contextId: community.conversationId,
                  conversationId: community.conversationId,
                  requesterId: null,
                  targetUserId: user.id,
                  organizationId: community.organizationId,
                  targetOrganizationId: community.organizationId,
                  title: community.title,
                  sourceTable: "community_invite_link_redeem",
                  sourceId: linkRedeemSourceId,
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
                  contextId: community.conversationId,
                  conversationId: community.conversationId,
                  requesterId: null,
                  targetUserId: user.id,
                  organizationId: community.organizationId,
                  targetOrganizationId: community.organizationId,
                  title: community.title,
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

              await upsertCommunityConversationMember({
                tx,
                conversationId: community.conversationId,
                userId: user.id,
              });
            });

            return jsonWrap({
              ok: true,
              contextType: "ORG_COMMUNITY",
              conversationId: community.conversationId,
            });
          }
        }

        const pendingInvite = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "COMMUNITY_INVITE",
            status: "PENDING",
            targetUserId: user.id,
            conversationId: community.conversationId,
          },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (pendingInvite) {
          return jsonWrap({
            ok: true,
            contextType: "ORG_COMMUNITY",
            grantId: pendingInvite.id,
            grantStatus: pendingInvite.status,
            requiresGrantAccept: true,
          });
        }

        return jsonWrap({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
      }

      return jsonWrap({ ok: false, error: "UNSUPPORTED_ACCESS_MODE" }, { status: 400 });
    }

    if (contextTypeRaw === "USER_DM" || contextTypeRaw === "ORG_CONTACT" || contextTypeRaw === "SERVICE") {
      if (contextTypeRaw === "USER_DM") {
        const targetUserId = typeof payload?.targetUserId === "string" ? payload.targetUserId.trim() : "";
        if (!targetUserId || targetUserId === user.id) {
          return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
        }

        const block = await prisma.chatUserBlock.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: targetUserId },
              { blockerId: targetUserId, blockedId: user.id },
            ],
          },
          select: { id: true },
        });
        if (block) {
          return jsonWrap({ ok: false, error: "CHAT_BLOCKED" }, { status: 403 });
        }

        const dmContextId = buildDmContextId(user.id, targetUserId);
        const existingConversation = await prisma.chatConversation.findFirst({
          where: {
            organizationId: null,
            contextType: ChatConversationContextType.USER_DM,
            contextId: dmContextId,
          },
          select: { id: true },
        });

        if (existingConversation) {
          return jsonWrap({ ok: true, contextType: contextTypeRaw, conversationId: existingConversation.id });
        }

        const [mutualFollow, inversePending] = await Promise.all([
          hasMutualFollow(user.id, targetUserId),
          prisma.chatAccessGrant.findFirst({
            where: {
              kind: "USER_DM_REQUEST",
              status: "PENDING",
              requesterId: targetUserId,
              targetUserId: user.id,
              contextType: "USER_DM",
            },
            select: { id: true },
          }),
        ]);

        if (mutualFollow || inversePending) {
          const now = new Date();
          const conversationId = await ensureDmConversation(user.id, targetUserId, user.id);

          if (inversePending?.id) {
            await prisma.chatAccessGrant.update({
              where: { id: inversePending.id },
              data: {
                status: "AUTO_ACCEPTED",
                conversationId,
                acceptedAt: now,
                resolvedAt: now,
                updatedAt: now,
              },
            });
          }

          const grant = await upsertGrantByCanonicalKey({
            key: `dm:${dmContextId}:requester:${user.id}`,
            kind: "USER_DM_REQUEST",
            status: inversePending ? "AUTO_ACCEPTED" : "ACCEPTED",
            contextType: "USER_DM",
            contextId: dmContextId,
            requesterId: user.id,
            targetUserId,
            conversationId,
            metadata: { canonical: true, autoAccepted: Boolean(inversePending) },
          });

          return jsonWrap({
            ok: true,
            contextType: contextTypeRaw,
            conversationId,
            grantId: grant.id,
            grantStatus: grant.status,
          });
        }

        const existingPending = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "USER_DM_REQUEST",
            status: "PENDING",
            requesterId: user.id,
            targetUserId,
            contextType: "USER_DM",
            contextId: dmContextId,
          },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (existingPending) {
          return jsonWrap({
            ok: true,
            contextType: contextTypeRaw,
            request: {
              id: existingPending.id,
              status: existingPending.status,
              createdAt: existingPending.createdAt.toISOString(),
            },
            grantId: existingPending.id,
            grantStatus: existingPending.status,
          });
        }

        const grant = await upsertGrantByCanonicalKey({
          key: `dm:${dmContextId}:requester:${user.id}`,
          kind: "USER_DM_REQUEST",
          status: "PENDING",
          contextType: "USER_DM",
          contextId: dmContextId,
          requesterId: user.id,
          targetUserId,
          metadata: { canonical: true },
        });

        return jsonWrap({
          ok: true,
          contextType: contextTypeRaw,
          request: {
            id: grant.id,
            status: grant.status,
            createdAt: grant.createdAt.toISOString(),
          },
          grantId: grant.id,
          grantStatus: grant.status,
        });
      }

      if (contextTypeRaw === "ORG_CONTACT") {
        const targetOrganizationId = parseNumber(payload?.targetOrganizationId);
        if (!targetOrganizationId) {
          return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({
          where: { id: targetOrganizationId },
          select: { id: true },
        });
        if (!org) {
          return jsonWrap({ ok: false, error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
        }

        const existingConversation = await prisma.chatConversation.findFirst({
          where: {
            organizationId: targetOrganizationId,
            contextType: "ORG_CONTACT",
            customerId: user.id,
          },
          select: { id: true },
        });
        if (existingConversation) {
          return jsonWrap({ ok: true, contextType: contextTypeRaw, conversationId: existingConversation.id });
        }

        const existingPending = await prisma.chatAccessGrant.findFirst({
          where: {
            kind: "ORG_CONTACT_REQUEST",
            status: "PENDING",
            requesterId: user.id,
            targetOrganizationId,
            contextType: "ORG_CONTACT",
          },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (existingPending) {
          return jsonWrap({
            ok: true,
            contextType: contextTypeRaw,
            request: {
              id: existingPending.id,
              status: existingPending.status,
              createdAt: existingPending.createdAt.toISOString(),
            },
            grantId: existingPending.id,
            grantStatus: existingPending.status,
          });
        }

        const grant = await upsertGrantByCanonicalKey({
          key: `org-contact:org:${targetOrganizationId}:requester:${user.id}`,
          kind: "ORG_CONTACT_REQUEST",
          status: "PENDING",
          contextType: "ORG_CONTACT",
          contextId: "ORG_CONTACT",
          requesterId: user.id,
          targetOrganizationId,
          organizationId: targetOrganizationId,
          metadata: { canonical: true },
        });

        return jsonWrap({
          ok: true,
          contextType: contextTypeRaw,
          request: {
            id: grant.id,
            status: grant.status,
            createdAt: grant.createdAt.toISOString(),
          },
          grantId: grant.id,
          grantStatus: grant.status,
        });
      }

      const serviceId = parseNumber(payload?.serviceId ?? payload?.contextId);
      if (!serviceId) {
        return jsonWrap({ ok: false, error: "SERVICE_NOT_FOUND" }, { status: 404 });
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, organizationId: true, isActive: true },
      });
      if (!service || !service.organizationId) {
        return jsonWrap({ ok: false, error: "SERVICE_NOT_FOUND" }, { status: 404 });
      }

      const existingConversation = await prisma.chatConversation.findFirst({
        where: {
          organizationId: service.organizationId,
          contextType: "SERVICE",
          contextId: String(service.id),
          customerId: user.id,
        },
        select: { id: true },
      });
      if (existingConversation) {
        return jsonWrap({ ok: true, contextType: contextTypeRaw, conversationId: existingConversation.id });
      }

      const existingPending = await prisma.chatAccessGrant.findFirst({
        where: {
          kind: "SERVICE_REQUEST",
          status: "PENDING",
          requesterId: user.id,
          targetOrganizationId: service.organizationId,
          contextType: "SERVICE",
          contextId: String(service.id),
        },
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      if (existingPending) {
        return jsonWrap({
          ok: true,
          contextType: contextTypeRaw,
          request: {
            id: existingPending.id,
            status: existingPending.status,
            createdAt: existingPending.createdAt.toISOString(),
          },
          grantId: existingPending.id,
          grantStatus: existingPending.status,
        });
      }

      const grant = await upsertGrantByCanonicalKey({
        key: `service:${service.id}:org:${service.organizationId}:requester:${user.id}`,
        kind: "SERVICE_REQUEST",
        status: "PENDING",
        contextType: "SERVICE",
        contextId: String(service.id),
        requesterId: user.id,
        targetOrganizationId: service.organizationId,
        organizationId: service.organizationId,
        metadata: { canonical: true },
      });

      return jsonWrap({
        ok: true,
        contextType: contextTypeRaw,
        request: {
          id: grant.id,
          status: grant.status,
          createdAt: grant.createdAt.toISOString(),
        },
        grantId: grant.id,
        grantStatus: grant.status,
      });
    }

    if (contextTypeRaw === "BOOKING") {
      const bookingId = parseNumber(payload?.bookingId ?? payload?.contextId);
      if (!bookingId) {
        return jsonWrap({ ok: false, error: "INVALID_BOOKING" }, { status: 400 });
      }

      const conversation = await prisma.chatConversation.findFirst({
        where: {
          contextType: "BOOKING",
          contextId: String(bookingId),
          customerId: user.id,
        },
        select: { id: true },
      });

      if (conversation) {
        return jsonWrap({ ok: true, conversationId: conversation.id, contextType: "BOOKING" });
      }

      return jsonWrap({
        ok: true,
        contextType: "BOOKING",
        requiresFirstMessage: true,
      });
    }

    if (contextTypeRaw === "EVENT") {
      const eventId = parseNumber(payload?.eventId ?? payload?.contextId);
      if (!eventId) {
        return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
      }

      const grant = await resolveEventGrantForUser(eventId, user.id, user.email ?? null);
      if (!grant) {
        return jsonWrap({ ok: false, error: "GRANT_REQUIRED" }, { status: 403 });
      }

      const grantStatus = mapLegacyStatus(grant.status);
      if (grantStatus === "ACCEPTED" || grantStatus === "AUTO_ACCEPTED") {
        const conversationId = await ensureEventConversation(eventId, grant.conversationId ?? null);
        if (conversationId && conversationId !== grant.conversationId) {
          await prisma.chatAccessGrant.update({
            where: { id: grant.id },
            data: { conversationId, updatedAt: new Date() },
          });
        }

        return jsonWrap({
          ok: true,
          contextType: "EVENT",
          conversationId,
          threadId: grant.threadId ?? null,
          grantId: grant.id,
          grantStatus,
        });
      }

      return jsonWrap({
        ok: true,
        contextType: "EVENT",
        grantId: grant.id,
        grantStatus,
        requiresGrantAccept: true,
        expiresAt: grant.expiresAt ? new Date(grant.expiresAt).toISOString() : null,
      });
    }

    return jsonWrap({ ok: false, error: "UNSUPPORTED_CONTEXT" }, { status: 400 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/conversations/resolve error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
