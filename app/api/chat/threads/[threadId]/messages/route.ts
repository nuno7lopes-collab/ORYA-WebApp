export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import { OrganizationMemberRole } from "@prisma/client";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { isChatRedisAvailable, isChatUserOnline } from "@/lib/chat/redis";

const CHAT_ORG_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

function parseLimit(raw: string | null) {
  const value = Number(raw ?? "40");
  if (!Number.isFinite(value)) return 40;
  return Math.min(Math.max(value, 1), 200);
}

function encodeCursor(message: { id: string; createdAt: Date }) {
  const payload = JSON.stringify({ id: message.id, createdAt: message.createdAt.toISOString() });
  return Buffer.from(payload).toString("base64url");
}

function decodeCursor(raw: string | null) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { id?: string; createdAt?: string };
    if (!parsed?.id || !parsed?.createdAt) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { id: parsed.id, createdAt };
  } catch {
    return null;
  }
}

async function userIsOrgMember(userId: string, organizationId: number | null) {
  if (!organizationId) return false;
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: CHAT_ORG_ROLES },
    },
    select: { id: true },
  });
  return Boolean(member);
}

async function resolveInviteAccess(
  threadId: string,
  userId: string,
  ownerClauses: Array<Record<string, unknown>>,
) {
  const now = new Date();
  const invite = await prisma.chatEventInvite.findFirst({
    where: { threadId, userId, status: "ACCEPTED" },
    select: { id: true, entitlementId: true, status: true, revokedAt: true },
  });
  if (!invite) return { ok: false as const, reason: "INVITE_REQUIRED" };
  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ok: true as const, writeAllowed: false as const };
  }
  if (!ownerClauses.length) {
    await prisma.$transaction([
      prisma.chatEventInvite.update({
        where: { id: invite.id },
        data: { status: "REVOKED", revokedAt: now, updatedAt: now },
      }),
      prisma.chatMember.updateMany({
        where: { threadId, userId },
        data: { accessRevokedAt: now },
      }),
    ]);
    return { ok: true as const, writeAllowed: false as const };
  }

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      id: invite.entitlementId,
      status: "ACTIVE",
      OR: ownerClauses as any,
      checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
    },
    select: { id: true },
  });

  if (!entitlement) {
    await prisma.$transaction([
      prisma.chatEventInvite.update({
        where: { id: invite.id },
        data: { status: "REVOKED", revokedAt: now, updatedAt: now },
      }),
      prisma.chatMember.updateMany({
        where: { threadId, userId },
        data: { accessRevokedAt: now },
      }),
    ]);
    return { ok: true as const, writeAllowed: false as const };
  }

  return { ok: true as const, writeAllowed: true as const };
}

async function ensureMemberAccess(threadId: string, user: { id: string; email?: string | null }) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      status: true,
      entityType: true,
      entityId: true,
      openAt: true,
      readOnlyAt: true,
      closeAt: true,
    },
  });
  if (!thread || thread.entityType !== "EVENT") {
    return { ok: false as const, error: "THREAD_NOT_FOUND" };
  }

  const event = await prisma.event.findFirst({
    where: { id: thread.entityId, isDeleted: false },
    select: { id: true, organizationId: true, ownerUserId: true, startsAt: true, endsAt: true },
  });
  if (!event) return { ok: false as const, error: "EVENT_NOT_FOUND" };

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isPlatformAdmin = roles.includes("admin");
  const isOwner = event.ownerUserId === user.id;
  const isOrgMember = await userIsOrgMember(user.id, event.organizationId ?? null);

  const now = new Date();
  const existingMember = await prisma.chatMember.findFirst({
    where: { threadId: thread.id, userId: user.id },
    select: { id: true, bannedAt: true },
  });
  if (existingMember?.bannedAt) {
    return { ok: false as const, error: "BANNED" };
  }

  let role: "ORG" | "PLATFORM_ADMIN" | "PARTICIPANT" | null = null;
  const identityIds = await getUserIdentityIds(user.id);
  const ownerClauses = buildEntitlementOwnerClauses({
    userId: user.id,
    identityIds,
    email: user.email ?? null,
  });

  let participantInviteAccess: Awaited<ReturnType<typeof resolveInviteAccess>> | null = null;
  if (isPlatformAdmin) {
    role = "PLATFORM_ADMIN";
  } else if (isOwner || isOrgMember) {
    role = "ORG";
  } else {
    participantInviteAccess = await resolveInviteAccess(thread.id, user.id, ownerClauses);
    if (!participantInviteAccess.ok) {
      return { ok: false as const, error: participantInviteAccess.reason };
    }
    role = "PARTICIPANT";
  }

  const writeAllowed =
    role !== "PARTICIPANT" ? true : Boolean(participantInviteAccess?.writeAllowed);

  if (role) {
    await prisma.chatMember.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: user.id } },
      update: {
        leftAt: null,
        role,
        accessRevokedAt: role === "PARTICIPANT" && !writeAllowed ? now : null,
      },
      create: {
        threadId: thread.id,
        userId: user.id,
        role,
        accessRevokedAt: role === "PARTICIPANT" && !writeAllowed ? now : null,
      },
    });
  }

  return { ok: true as const, thread, role, writeAllowed };
}

async function _GET(req: NextRequest, context: { params: { threadId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const threadId = context.params.threadId;
    const access = await ensureMemberAccess(threadId, user);
    if (!access.ok) {
      const status = access.error === "THREAD_NOT_FOUND" || access.error === "EVENT_NOT_FOUND" ? 404 : 403;
      return jsonWrap({ error: access.error }, { status });
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));
    const after = decodeCursor(req.nextUrl.searchParams.get("after"));

    const threadPayload = {
      id: access.thread.id,
      status: access.thread.status,
      openAt: access.thread.openAt.toISOString(),
      readOnlyAt: access.thread.readOnlyAt.toISOString(),
      closeAt: access.thread.closeAt.toISOString(),
    };

    if (after) {
      const items = await prisma.chatMessage.findMany({
        where: {
          threadId,
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
        select: {
          id: true,
          body: true,
          kind: true,
          createdAt: true,
          deletedAt: true,
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });

      const latest = items.length > 0 ? encodeCursor(items[items.length - 1]) : null;

      return jsonWrap({
        thread: threadPayload,
        items: items.map((item) => ({
          id: item.id,
          body: item.deletedAt ? null : item.body,
          kind: item.kind,
          createdAt: item.createdAt.toISOString(),
          deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
          sender: item.user
            ? {
                id: item.user.id,
                fullName: item.user.fullName,
                username: item.user.username,
                avatarUrl: item.user.avatarUrl,
              }
            : null,
        })),
        latestCursor: latest,
      });
    }

      const items = await prisma.chatMessage.findMany({
        where: {
          threadId,
          ...(cursor
            ? {
                OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
        select: {
          id: true,
          body: true,
          kind: true,
          createdAt: true,
          deletedAt: true,
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });

    const ordered = items.slice().reverse();
    const nextCursor = items.length === limit ? encodeCursor(items[items.length - 1]) : null;
    const latestCursor =
      ordered.length > 0 ? encodeCursor(ordered[ordered.length - 1]) : null;

    return jsonWrap({
      thread: threadPayload,
      items: ordered.map((item) => ({
        id: item.id,
        body: item.deletedAt ? null : item.body,
        kind: item.kind,
        createdAt: item.createdAt.toISOString(),
        deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
        sender: item.user
          ? {
              id: item.user.id,
              fullName: item.user.fullName,
              username: item.user.username,
              avatarUrl: item.user.avatarUrl,
          }
          : null,
      })),
      nextCursor,
      latestCursor,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads/messages] error", err);
    return jsonWrap({ error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, context: { params: { threadId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const threadId = context.params.threadId;

    const access = await ensureMemberAccess(threadId, user);
    if (!access.ok) {
      const status = access.error === "THREAD_NOT_FOUND" || access.error === "EVENT_NOT_FOUND" ? 404 : 403;
      return jsonWrap({ error: access.error }, { status });
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body) {
      return jsonWrap({ error: "EMPTY_BODY" }, { status: 400 });
    }
    if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    const thread = access.thread;
    const threadPayload = {
      id: thread.id,
      status: thread.status,
      openAt: thread.openAt.toISOString(),
      readOnlyAt: thread.readOnlyAt.toISOString(),
      closeAt: thread.closeAt.toISOString(),
    };

    if (!access.writeAllowed) {
      return jsonWrap({ error: "READ_ONLY" }, { status: 403 });
    }

    if (thread.status === "READ_ONLY" || thread.status === "CLOSED") {
      return jsonWrap({ error: "READ_ONLY" }, { status: 403 });
    }

    if (thread.status === "ANNOUNCEMENTS") {
      if (access.role !== "ORG" && access.role !== "PLATFORM_ADMIN") {
        return jsonWrap({ error: "READ_ONLY" }, { status: 403 });
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        threadId,
        userId: user.id,
        body,
        kind: thread.status === "ANNOUNCEMENTS" ? "ANNOUNCEMENT" : "USER",
      },
      select: {
        id: true,
        body: true,
        kind: true,
        createdAt: true,
        deletedAt: true,
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    const recipients = await prisma.chatMember.findMany({
      where: { threadId, userId: { not: user.id }, bannedAt: null },
      select: { userId: true, mutedUntil: true },
    });

    const now = new Date();
    const preview = body.length > 160 ? `${body.slice(0, 157)}…` : body;

    if (isChatRedisAvailable()) {
      for (const recipient of recipients) {
        if (recipient.mutedUntil && recipient.mutedUntil > now) continue;
        const online = await isChatUserOnline(recipient.userId);
        if (online) continue;
        await enqueueNotification({
          dedupeKey: `chat_message:${message.id}:${recipient.userId}`,
          userId: recipient.userId,
          notificationType: "CHAT_MESSAGE",
          payload: {
            threadId,
            eventId: thread.entityId,
            messageId: message.id,
            senderId: user.id,
            preview,
            contextType: "EVENT",
          },
        });
      }
    }

    return jsonWrap({
      thread: threadPayload,
      item: {
        id: message.id,
        body: message.body,
        kind: message.kind,
        createdAt: message.createdAt.toISOString(),
        deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
        sender: message.user
          ? {
              id: message.user.id,
              fullName: message.user.fullName,
              username: message.user.username,
              avatarUrl: message.user.avatarUrl,
            }
          : null,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads/messages][post] error", err);
    return jsonWrap({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
