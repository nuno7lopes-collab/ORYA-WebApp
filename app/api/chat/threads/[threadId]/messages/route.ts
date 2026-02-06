export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import { OrganizationMemberRole } from "@prisma/client";

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

async function userHasEventAccess(userId: string, eventId: number) {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      ownerUserId: userId,
      eventId,
      status: { in: ["ACTIVE", "USED"] },
    },
    select: { id: true },
  });
  return Boolean(entitlement);
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

async function ensureMemberAccess(threadId: string, userId: string) {
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

  const existingMember = await prisma.chatMember.findFirst({
    where: { threadId: thread.id, userId },
    select: { id: true, bannedAt: true },
  });
  if (existingMember?.bannedAt) {
    return { ok: false as const, error: "BANNED" };
  }

  if (!existingMember) {
    const event = await prisma.event.findFirst({
      where: { id: thread.entityId, isDeleted: false },
      select: { id: true, organizationId: true, ownerUserId: true },
    });
    if (!event) return { ok: false as const, error: "EVENT_NOT_FOUND" };
    const isOwner = event.ownerUserId === userId;
    const hasEntitlement = await userHasEventAccess(userId, event.id);
    const isOrgMember = await userIsOrgMember(userId, event.organizationId ?? null);
    if (!isOwner && !hasEntitlement && !isOrgMember) {
      return { ok: false as const, error: "FORBIDDEN" };
    }
    const role = isOwner || isOrgMember ? "ORG" : "PARTICIPANT";
    await prisma.chatMember.upsert({
      where: { threadId_userId: { threadId: thread.id, userId } },
      update: { leftAt: null, role },
      create: { threadId: thread.id, userId, role },
    });
  }

  return { ok: true as const, thread };
}

async function _GET(req: NextRequest, context: { params: { threadId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const threadId = context.params.threadId;
    const access = await ensureMemberAccess(threadId, user.id);
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
          deletedAt: null,
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
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });

      const latest = items.length > 0 ? encodeCursor(items[items.length - 1]) : null;

      return jsonWrap({
        thread: threadPayload,
        items: items.map((item) => ({
          id: item.id,
          body: item.body,
          kind: item.kind,
          createdAt: item.createdAt.toISOString(),
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
        deletedAt: null,
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
        body: item.body,
        kind: item.kind,
        createdAt: item.createdAt.toISOString(),
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

    const access = await ensureMemberAccess(threadId, user.id);
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

    if (thread.status === "READ_ONLY" || thread.status === "CLOSED") {
      return jsonWrap({ error: "READ_ONLY" }, { status: 403 });
    }

    if (thread.status === "ANNOUNCEMENTS") {
      const event = await prisma.event.findFirst({
        where: { id: thread.entityId, isDeleted: false },
        select: { ownerUserId: true, organizationId: true },
      });
      const isOwner = event?.ownerUserId === user.id;
      const isOrgMember = await userIsOrgMember(user.id, event?.organizationId ?? null);
      if (!isOwner && !isOrgMember) {
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
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    return jsonWrap({
      thread: threadPayload,
      item: {
        id: message.id,
        body: message.body,
        kind: message.kind,
        createdAt: message.createdAt.toISOString(),
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
