export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const CHAT_ATTACHMENTS_PUBLIC = process.env.CHAT_ATTACHMENTS_PUBLIC === "true";

async function resolveAttachmentUrls<T extends { attachments: any[] }>(items: T[]) {
  if (CHAT_ATTACHMENTS_PUBLIC) return items;
  const ttlSeconds = env.storageSignedTtlSeconds;
  return Promise.all(
    items.map(async (item) => {
      if (!item.attachments?.length) return item;
      const resolved = await Promise.all(
        item.attachments.map(async (attachment) => {
          const metadata =
            attachment?.metadata && typeof attachment.metadata === "object"
              ? (attachment.metadata as Record<string, unknown>)
              : {};
          const path = typeof metadata.path === "string" ? metadata.path : null;
          const bucket =
            typeof metadata.bucket === "string"
              ? metadata.bucket
              : process.env.CHAT_ATTACHMENTS_BUCKET ?? env.uploadsBucket ?? "uploads";
          if (!path || !bucket) return attachment;
          const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, ttlSeconds);
          if (signed.data?.signedUrl) {
            return { ...attachment, url: signed.data.signedUrl };
          }
          return attachment;
        }),
      );
      return { ...item, attachments: resolved };
    }),
  );
}

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
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

async function _GET(req: NextRequest, context: { params: { conversationId: string } }) {
  try {

    const { user, organization } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 80,
      keyPrefix: "chat:messages",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const { conversationId } = await context.params;
    const membership = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            title: true,
          },
        },
      },
    });

    if (!membership?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));
    const after = decodeCursor(req.nextUrl.searchParams.get("after"));
    const aroundId = req.nextUrl.searchParams.get("around")?.trim() ?? null;
    const includeMembers = req.nextUrl.searchParams.get("includeMembers") !== "0";

    if (aroundId) {
      const target = await prisma.chatConversationMessage.findFirst({
        where: { id: aroundId, conversationId, deletedAt: null, replyToId: null },
        include: {
          sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            },
          },
          pins: true,
          replyTo: {
            select: {
              id: true,
              body: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      });

      if (!target) {
        return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
      }

      const before = await prisma.chatConversationMessage.findMany({
        where: {
          conversationId,
          deletedAt: null,
          replyToId: null,
          OR: [
            { createdAt: { lt: target.createdAt } },
            { createdAt: target.createdAt, id: { lt: target.id } },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: {
          sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            },
          },
          pins: true,
          replyTo: {
            select: {
              id: true,
              body: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      });

      const afterRows = await prisma.chatConversationMessage.findMany({
        where: {
          conversationId,
          deletedAt: null,
          replyToId: null,
          OR: [
            { createdAt: { gt: target.createdAt } },
            { createdAt: target.createdAt, id: { gt: target.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
        include: {
          sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            },
          },
          pins: true,
          replyTo: {
            select: {
              id: true,
              body: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      });

      const merged = [...before.slice().reverse(), target, ...afterRows];
      const items = await resolveAttachmentUrls(merged);
      const nextCursor = before.length === limit ? encodeCursor(before[before.length - 1]) : null;

      return jsonWrap({
        ok: true,
        conversation: membership.conversation,
        members: [],
        items,
        nextCursor,
      });
    }

    const where = after
      ? {
          conversationId,
          deletedAt: null,
          replyToId: null,
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        }
      : cursor
        ? {
            conversationId,
            deletedAt: null,
            replyToId: null,
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : { conversationId, deletedAt: null, replyToId: null };

    const orderBy = after
      ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
      : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const messages = await prisma.chatConversationMessage.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          },
        },
        pins: true,
        replyTo: {
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    });

    const normalizedMessages = after ? messages : messages.slice().reverse();
    const items = await resolveAttachmentUrls(normalizedMessages);
    const nextCursor = messages.length ? encodeCursor(messages[messages.length - 1]) : null;

    const members = includeMembers
      ? await prisma.chatConversationMember.findMany({
          where: { conversationId },
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            lastReadMessage: { select: { id: true, createdAt: true } },
          },
          orderBy: { joinedAt: "asc" },
        })
      : [];

    const memberIds = members.map((member) => member.userId);
    const presenceRows = memberIds.length
      ? await prisma.chatUserPresence.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true, lastSeenAt: true },
        })
      : [];
    const presenceMap = new Map(presenceRows.map((row) => [row.userId, row.lastSeenAt]));

    const serializedMembers = members.map((member) => ({
      userId: member.userId,
      role: member.role,
      lastReadMessageId: member.lastReadMessageId,
      lastReadAt: member.lastReadAt ?? member.lastReadMessage?.createdAt ?? null,
      mutedUntil: member.mutedUntil,
      notifLevel: member.notifLevel,
      profile: {
        id: member.user.id,
        fullName: member.user.fullName,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
        lastSeenAt: presenceMap.get(member.userId) ?? null,
      },
    }));

    return jsonWrap({
      ok: true,
      conversation: membership.conversation,
      members: serializedMembers,
      items,
      nextCursor,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/conversations/[id]/messages error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);