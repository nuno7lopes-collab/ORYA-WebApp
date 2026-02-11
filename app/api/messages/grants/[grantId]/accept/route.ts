export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getMessagesScope } from "@/app/api/messages/_scope";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";

function buildDmContextId(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function ensureDmConversation(userA: string, userB: string, createdByUserId: string) {
  const contextId = buildDmContextId(userA, userB);
  const existing = await prisma.chatConversation.findFirst({
    where: {
      organizationId: null,
      contextType: "USER_DM",
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
        contextType: "USER_DM",
        contextId,
        createdByUserId,
        members: {
          create: [
            { userId: userA, role: "MEMBER" },
            { userId: userB, role: "MEMBER" },
          ],
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const afterConflict = await prisma.chatConversation.findFirst({
      where: {
        organizationId: null,
        contextType: "USER_DM",
        contextId,
      },
      select: { id: true },
    });
    if (!afterConflict) throw err;
    return afterConflict.id;
  }
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

async function canAccessEventGrant(params: {
  userId: string;
  email: string | null;
  entitlementId: string | null;
  eventId: number | null;
}) {
  if (!params.entitlementId || !params.eventId) return false;
  const identityIds = await getUserIdentityIds(params.userId);
  const ownerClauses = buildEntitlementOwnerClauses({
    userId: params.userId,
    identityIds,
    email: params.email,
  });
  if (!ownerClauses.length) return false;

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      id: params.entitlementId,
      eventId: params.eventId,
      status: "ACTIVE",
      OR: ownerClauses,
      checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
    },
    select: { id: true },
  });

  return Boolean(entitlement);
}

async function ensureOrgOrServiceConversation(params: {
  organizationId: number;
  requesterId: string;
  contextType: "ORG_CONTACT" | "SERVICE";
  contextId: string | null;
  actorUserId: string;
}) {
  const existing = await prisma.chatConversation.findFirst({
    where: {
      organizationId: params.organizationId,
      contextType: params.contextType,
      contextId: params.contextId,
      customerId: params.requesterId,
    },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  let serviceInstructorId: string | null = null;
  if (params.contextType === "SERVICE" && params.contextId) {
    const serviceId = Number(params.contextId);
    if (Number.isFinite(serviceId)) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, organizationId: params.organizationId },
        select: { instructorId: true },
      });
      serviceInstructorId = service?.instructorId ?? null;
    }
  }

  const requesterProfile = await prisma.profile.findUnique({
    where: { id: params.requesterId },
    select: { fullName: true, username: true },
  });
  const title =
    requesterProfile?.fullName?.trim() ||
    (requesterProfile?.username ? `@${requesterProfile.username}` : "Conversa");

  const members = new Map<string, {
    userId: string;
    role: "MEMBER" | "ADMIN";
    organizationId: number | null;
    displayAs: "ORGANIZATION" | "PROFESSIONAL";
    hiddenFromCustomer: boolean;
  }>();

  members.set(params.requesterId, {
    userId: params.requesterId,
    role: "MEMBER",
    organizationId: null,
    displayAs: "ORGANIZATION",
    hiddenFromCustomer: false,
  });

  members.set(params.actorUserId, {
    userId: params.actorUserId,
    role: "ADMIN",
    organizationId: params.organizationId,
    displayAs: "ORGANIZATION",
    hiddenFromCustomer: true,
  });

  if (serviceInstructorId) {
    members.set(serviceInstructorId, {
      userId: serviceInstructorId,
      role: "MEMBER",
      organizationId: params.organizationId,
      displayAs: "PROFESSIONAL",
      hiddenFromCustomer: false,
    });
  }

  try {
    const conversation = await prisma.chatConversation.create({
      data: {
        organizationId: params.organizationId,
        type: "CHANNEL",
        contextType: params.contextType,
        contextId: params.contextId,
        customerId: params.requesterId,
        professionalId: serviceInstructorId,
        title,
        createdByUserId: params.actorUserId,
        members: {
          create: Array.from(members.values()),
        },
      },
      select: { id: true },
    });
    return conversation.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const afterConflict = await prisma.chatConversation.findFirst({
      where: {
        organizationId: params.organizationId,
        contextType: params.contextType,
        contextId: params.contextId,
        customerId: params.requesterId,
      },
      select: { id: true },
    });
    if (!afterConflict) throw err;
    return afterConflict.id;
  }
}

export async function POST(req: NextRequest, context: { params: { grantId: string } }) {
  try {
    const grantId = context.params.grantId?.trim();
    if (!grantId) {
      return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const scope = getMessagesScope(req);

    const orgContext =
      scope === "org"
        ? await requireChatContext(req)
        : null;

    const grant = await prisma.chatAccessGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        kind: true,
        status: true,
        contextType: true,
        contextId: true,
        requesterId: true,
        targetUserId: true,
        targetOrganizationId: true,
        organizationId: true,
        eventId: true,
        entitlementId: true,
        conversationId: true,
        threadId: true,
        title: true,
        expiresAt: true,
        metadata: true,
      },
    });

    if (!grant) {
      return jsonWrap({ ok: false, error: "GRANT_NOT_FOUND" }, { status: 404 });
    }

    if (grant.status !== "PENDING") {
      return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    if (grant.expiresAt && grant.expiresAt <= new Date()) {
      await prisma.chatAccessGrant.update({
        where: { id: grant.id },
        data: { status: "EXPIRED", resolvedAt: new Date(), updatedAt: new Date() },
      });
      return jsonWrap({ ok: false, error: "GRANT_EXPIRED" }, { status: 410 });
    }

    if (grant.kind === "EVENT_INVITE") {
      if (!(await canAccessEventGrant({
        userId: user.id,
        email: user.email ?? null,
        entitlementId: grant.entitlementId,
        eventId: grant.eventId,
      }))) {
        return jsonWrap({ ok: false, error: "CHECKIN_REQUIRED" }, { status: 403 });
      }

      if (!grant.eventId) {
        return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
      }

      const conversationId = await ensureEventConversation(grant.eventId, grant.conversationId ?? null);
      if (!conversationId) {
        return jsonWrap({ ok: false, error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
      }

      const banned = await prisma.chatConversationMember.findFirst({
        where: {
          conversationId,
          userId: user.id,
          bannedAt: { not: null },
        },
        select: { userId: true },
      });
      if (banned) {
        return jsonWrap({ ok: false, error: "BANNED" }, { status: 403 });
      }

      const now = new Date();
      const conversation = await prisma.chatConversation.findUnique({
        where: { id: conversationId },
        select: { organizationId: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.chatAccessGrant.update({
          where: { id: grant.id },
          data: {
            status: "ACCEPTED",
            targetUserId: user.id,
            conversationId,
            acceptedAt: now,
            resolvedAt: now,
            updatedAt: now,
          },
        });

        await tx.chatConversationMember.upsert({
          where: { conversationId_userId: { conversationId, userId: user.id } },
          update: {
            leftAt: null,
            accessRevokedAt: null,
          },
          create: {
            conversationId,
            userId: user.id,
            role: "MEMBER",
            organizationId: conversation?.organizationId ?? null,
          },
        });
      });

      return jsonWrap({
        ok: true,
        invite: {
          id: grant.id,
          threadId: grant.threadId ?? conversationId,
          conversationId,
          status: "ACCEPTED",
          expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        },
        threadId: grant.threadId ?? conversationId,
        conversationId,
      });
    }

    if (grant.kind === "USER_DM_REQUEST") {
      if (grant.targetUserId && grant.targetUserId !== user.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (!grant.requesterId) {
        return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
      }

      const conversationId = await ensureDmConversation(grant.requesterId, user.id, grant.requesterId);
      const now = new Date();
      await prisma.chatAccessGrant.update({
        where: { id: grant.id },
        data: {
          status: "ACCEPTED",
          targetUserId: user.id,
          conversationId,
          acceptedAt: now,
          resolvedAt: now,
          updatedAt: now,
        },
      });

      return jsonWrap({ ok: true, conversationId });
    }

    if (grant.kind === "ORG_CONTACT_REQUEST" || grant.kind === "SERVICE_REQUEST") {
      if (!orgContext?.organization?.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }

      const orgId = grant.targetOrganizationId ?? grant.organizationId;
      if (!orgId || orgId !== orgContext.organization.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (!grant.requesterId) {
        return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
      }

      const contextType = grant.kind === "SERVICE_REQUEST" ? "SERVICE" : "ORG_CONTACT";
      const conversationId = await ensureOrgOrServiceConversation({
        organizationId: orgId,
        requesterId: grant.requesterId,
        contextType,
        contextId: grant.contextId,
        actorUserId: user.id,
      });

      const now = new Date();
      await prisma.chatAccessGrant.update({
        where: { id: grant.id },
        data: {
          status: "ACCEPTED",
          conversationId,
          resolvedByUserId: user.id,
          acceptedAt: now,
          resolvedAt: now,
          updatedAt: now,
        },
      });

      await publishChatEvent({
        type: "conversation:update",
        action: "created",
        organizationId: orgId,
        conversationId,
      });

      return jsonWrap({ ok: true, conversationId });
    }

    if (grant.kind === "CHANNEL_CREATE_REQUEST") {
      if (!orgContext?.organization?.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }

      const orgId = grant.targetOrganizationId ?? grant.organizationId;
      if (!orgId || orgId !== orgContext.organization.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      if (!grant.requesterId) {
        return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
      }

      const metadata = asRecord(grant.metadata);
      const requestedMembersRaw = Array.isArray(metadata.requestedMembers)
        ? metadata.requestedMembers.filter((value): value is string => typeof value === "string")
        : [];
      const uniqueMembers = Array.from(new Set([grant.requesterId, user.id, ...requestedMembersRaw]));

      const conversation = await prisma.chatConversation.create({
        data: {
          organizationId: orgId,
          type: "CHANNEL",
          contextType: "ORG_CHANNEL",
          title: grant.title ?? "Canal",
          createdByUserId: user.id,
          members: {
            create: uniqueMembers.map((memberId) => ({
              userId: memberId,
              role: memberId === user.id ? "ADMIN" : "MEMBER",
              organizationId: orgId,
            })),
          },
        },
      });

      const now = new Date();
      await prisma.chatAccessGrant.update({
        where: { id: grant.id },
        data: {
          status: "ACCEPTED",
          conversationId: conversation.id,
          resolvedByUserId: user.id,
          acceptedAt: now,
          resolvedAt: now,
          updatedAt: now,
        },
      });

      await publishChatEvent({
        type: "conversation:update",
        action: "created",
        organizationId: orgId,
        conversationId: conversation.id,
        conversation,
      });

      return jsonWrap({ ok: true, conversationId: conversation.id, conversation });
    }

    return jsonWrap({ ok: false, error: "UNSUPPORTED_GRANT_KIND" }, { status: 400 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    if (isChatRedisUnavailableError(err)) {
      return jsonWrap({ ok: false, error: err.code }, { status: 503 });
    }
    console.error("POST /api/messages/grants/[grantId]/accept error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
