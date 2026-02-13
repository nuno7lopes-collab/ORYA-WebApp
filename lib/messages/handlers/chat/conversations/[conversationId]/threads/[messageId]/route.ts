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

async function _GET(req: NextRequest, context: { params: { conversationId: string; messageId: string } }) {
  try {

    const { user, organization } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 60,
      keyPrefix: "chat:threads",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const { conversationId, messageId: rootMessageId } = await context.params;
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));

    const membership = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      select: { conversationId: true },
    });

    if (!membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const root = await prisma.chatConversationMessage.findFirst({
      where: { id: rootMessageId, conversationId },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          },
        },
        pins: true,
      },
    });

    if (!root) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    const where = cursor
      ? {
          conversationId,
          replyToId: rootMessageId,
          deletedAt: null,
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {
          conversationId,
          replyToId: rootMessageId,
          deletedAt: null,
        };

    const replies = await prisma.chatConversationMessage.findMany({
      where,
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
      },
    });

    const items = await resolveAttachmentUrls(replies.slice().reverse());
    const nextCursor = replies.length === limit ? encodeCursor(replies[replies.length - 1]) : null;
    const [resolvedRoot] = await resolveAttachmentUrls([root]);

    return jsonWrap({
      ok: true,
      root: resolvedRoot,
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
    console.error("GET /api/messages/conversations/[id]/threads/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar thread." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);