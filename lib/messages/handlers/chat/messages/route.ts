export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { MediaOwnerType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import {
  isChatRedisAvailable,
  isChatUserOnline,
  publishChatEvent,
} from "@/lib/chat/redis";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  CHAT_MAX_ATTACHMENT_BYTES,
  CHAT_MAX_ATTACHMENTS,
  CHAT_MESSAGE_MAX_LENGTH,
} from "@/lib/chat/constants";
import { enqueueNotification } from "@/domain/notifications/outbox";
import {
  resolvePostingWindow,
  resolvePostingWindowStatus,
} from "@/lib/messages/postingWindow";

const PREVIEW_MAX = 180;
const CHAT_ATTACHMENTS_PUBLIC = process.env.CHAT_ATTACHMENTS_PUBLIC === "true";
const B2C_CONTEXT_TYPES = new Set(["ORG_CONTACT", "BOOKING", "SERVICE"]);

type MessageWithRelations = Prisma.ChatConversationMessageGetPayload<{
  select: {
    id: true;
    conversationId: true;
    organizationId: true;
    senderId: true;
    body: true;
    clientMessageId: true;
    kind: true;
    metadata: true;
    createdAt: true;
    editedAt: true;
    deletedAt: true;
    replyToId: true;
    sender: { select: { id: true; fullName: true; username: true; avatarUrl: true } };
    attachments: true;
    reactions: { include: { user: { select: { id: true; fullName: true; username: true; avatarUrl: true } } } };
    pins: true;
    replyTo: {
      select: {
        id: true;
        body: true;
        senderId: true;
        createdAt: true;
      };
    };
  };
}>;

type AttachmentInput = {
  type?: unknown;
  url?: unknown;
  mime?: unknown;
  size?: unknown;
  metadata?: unknown;
};

type NormalizedAttachment = {
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  mime: string;
  size: number;
  metadata: Record<string, unknown>;
};

type PreparedAttachmentAsset = {
  bucket: string;
  objectPath: string;
  checksumSha256: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
};

function normalizeAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return { ok: true as const, items: [] as NormalizedAttachment[] };
  const items = raw.filter((entry): entry is AttachmentInput => typeof entry === "object" && entry !== null);
  if (items.length > CHAT_MAX_ATTACHMENTS) {
    return { ok: false as const, error: "TOO_MANY_ATTACHMENTS" };
  }
  const normalized = items.map((entry) => {
    const type = typeof entry.type === "string" ? entry.type.trim().toUpperCase() : "";
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    const mime = typeof entry.mime === "string" ? entry.mime.trim() : "";
    const size = typeof entry.size === "number" ? entry.size : Number(entry.size);
    const metadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
    return { type, url, mime, size, metadata };
  });
  for (const entry of normalized) {
    if (!entry.type || !["IMAGE", "VIDEO", "FILE"].includes(entry.type)) {
      return { ok: false as const, error: "INVALID_ATTACHMENT_TYPE" };
    }
    if (!entry.url) {
      return { ok: false as const, error: "INVALID_ATTACHMENT_URL" };
    }
    if (!entry.mime) {
      return { ok: false as const, error: "INVALID_ATTACHMENT_MIME" };
    }
    if (!Number.isFinite(entry.size) || entry.size <= 0) {
      return { ok: false as const, error: "INVALID_ATTACHMENT_SIZE" };
    }
    if (entry.size > CHAT_MAX_ATTACHMENT_BYTES) {
      return { ok: false as const, error: "ATTACHMENT_TOO_LARGE" };
    }
  }
  const typed = normalized.map((entry) => ({
    type: entry.type as NormalizedAttachment["type"],
    url: entry.url,
    mime: entry.mime,
    size: entry.size,
    metadata: entry.metadata as Record<string, unknown>,
  }));
  return { ok: true as const, items: typed };
}

async function prepareAttachmentAssets(items: NormalizedAttachment[]) {
  if (items.length === 0) {
    return { ok: true as const, items: [] as PreparedAttachmentAsset[] };
  }

  const prepared: PreparedAttachmentAsset[] = [];
  for (const entry of items) {
    const metadata = entry.metadata ?? {};
    const objectPath =
      typeof metadata.path === "string" && metadata.path.trim() ? metadata.path.trim() : null;
    if (!objectPath) {
      return { ok: false as const, error: "ATTACHMENT_METADATA_REQUIRED" };
    }
    const bucket =
      typeof metadata.bucket === "string" && metadata.bucket.trim()
        ? metadata.bucket.trim()
        : process.env.CHAT_ATTACHMENTS_BUCKET ?? env.uploadsBucket ?? "uploads";
    const checksumRaw =
      typeof metadata.checksumSha256 === "string" && metadata.checksumSha256.trim()
        ? metadata.checksumSha256.trim().toLowerCase()
        : null;
    if (!checksumRaw || !/^[a-f0-9]{64}$/.test(checksumRaw)) {
      return { ok: false as const, error: "ATTACHMENT_CHECKSUM_FAILED" };
    }
    const originalFilename =
      typeof metadata.filename === "string" && metadata.filename.trim()
        ? metadata.filename.trim()
        : typeof metadata.name === "string" && metadata.name.trim()
          ? metadata.name.trim()
          : null;
    prepared.push({
      bucket,
      objectPath,
      checksumSha256: checksumRaw,
      mimeType: entry.mime,
      sizeBytes: entry.size,
      originalFilename,
    });
  }

  return { ok: true as const, items: prepared };
}

function buildPreview(body: string | null) {
  if (!body) return "";
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, PREVIEW_MAX - 1)}…`;
}

function mapSenderForB2C(
  message: MessageWithRelations,
  member: {
    displayAs: "ORGANIZATION" | "PROFESSIONAL";
    conversation: {
      contextType: string | null;
      organization: {
        id: number;
        publicName: string | null;
        businessName: string | null;
        username: string | null;
        brandingAvatarUrl: string | null;
      } | null;
    };
  },
) {
  if (!member.conversation?.contextType || !B2C_CONTEXT_TYPES.has(member.conversation.contextType)) {
    return message;
  }
  if (member.displayAs !== "ORGANIZATION") return message;
  const org = member.conversation.organization;
  if (!org) return message;
  const orgName = org.publicName || org.businessName || "Organização";
  return {
    ...message,
    sender: {
      id: `org:${org.id}`,
      fullName: orgName,
      username: org.username ?? null,
      avatarUrl: org.brandingAvatarUrl ?? null,
    },
  };
}

async function resolveMessageAttachments<T extends { attachments: any[] }>(message: T) {
  if (CHAT_ATTACHMENTS_PUBLIC || !message.attachments?.length) return message;
  const ttlSeconds = env.storageSignedTtlSeconds;
  const resolved = await Promise.all(
    message.attachments.map(async (attachment) => {
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
  return { ...message, attachments: resolved };
}

async function _POST(req: NextRequest) {
  try {

    const { user, organization } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 20,
      keyPrefix: "chat:messages:send",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const payload = (await req.json().catch(() => null)) as {
      conversationId?: unknown;
      body?: unknown;
      attachments?: unknown;
      clientMessageId?: unknown;
      replyToId?: unknown;
      replyToMessageId?: unknown;
      kind?: unknown;
      metadata?: unknown;
    } | null;

    const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId.trim() : "";
    const clientMessageId = typeof payload?.clientMessageId === "string" ? payload.clientMessageId.trim() : "";
    const replyToIdRaw =
      typeof payload?.replyToId === "string"
        ? payload.replyToId.trim()
        : typeof payload?.replyToMessageId === "string"
          ? payload.replyToMessageId.trim()
          : null;
    const replyToId = replyToIdRaw && replyToIdRaw.length > 0 ? replyToIdRaw : null;
    const kindRaw = typeof payload?.kind === "string" ? payload.kind.trim().toUpperCase() : "TEXT";
    const kind = kindRaw === "SYSTEM" ? "SYSTEM" : "TEXT";
    const metadata =
      payload?.metadata && typeof payload.metadata === "object" ? (payload.metadata as Prisma.InputJsonValue) : undefined;

    if (!conversationId || !clientMessageId) {
      return jsonWrap({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const bodyRaw = typeof payload?.body === "string" ? payload.body.trim() : "";
    const body = bodyRaw.length > 0 ? bodyRaw : null;
    if (body && body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ ok: false, error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    if (Array.isArray(payload?.attachments) && payload.attachments.length > 0) {
      return jsonWrap({ ok: false, error: "ATTACHMENTS_DISABLED" }, { status: 400 });
    }

    const attachmentResult = normalizeAttachments(payload?.attachments);
    if (!attachmentResult.ok) {
      return jsonWrap({ ok: false, error: attachmentResult.error }, { status: 400 });
    }

    if (!body && attachmentResult.items.length === 0) {
      return jsonWrap({ ok: false, error: "EMPTY_MESSAGE" }, { status: 400 });
    }

    const preparedAssets = await prepareAttachmentAssets(attachmentResult.items);
    if (!preparedAssets.ok) {
      return jsonWrap({ ok: false, error: preparedAssets.error }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { organizationId: organization.id },
      },
      select: {
        displayAs: true,
        conversation: {
          select: {
            id: true,
            organizationId: true,
            type: true,
            contextType: true,
            contextId: true,
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                username: true,
                brandingAvatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!member?.conversation) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const posting = await resolvePostingWindow({
      contextType: member.conversation.contextType,
      contextId: member.conversation.contextId,
      organizationId: member.conversation.organizationId,
    });
    if (!posting.canPost) {
      return jsonWrap({ ok: false, error: posting.reason }, { status: resolvePostingWindowStatus(posting.reason) });
    }

    if (replyToId) {
      const replyExists = await prisma.chatConversationMessage.findFirst({
        where: { id: replyToId, conversationId },
        select: { id: true },
      });
      if (!replyExists) {
        return jsonWrap({ ok: false, error: "INVALID_REPLY" }, { status: 400 });
      }
    }

    const attachmentOwner =
      member.conversation.type === "CHANNEL"
        ? { ownerType: MediaOwnerType.ORGANIZATION, ownerId: String(organization.id) }
        : { ownerType: MediaOwnerType.USER, ownerId: user.id };

    const messageSelect = {
      id: true,
      conversationId: true,
      organizationId: true,
      senderId: true,
      body: true,
      clientMessageId: true,
      kind: true,
      metadata: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      replyToId: true,
      sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      attachments: true,
      reactions: {
        include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
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
    } as const;

    const uniqueWhere = {
      conversationId_senderId_clientMessageId: {
        conversationId,
        senderId: user.id,
        clientMessageId,
      },
    };

    let message: MessageWithRelations | null = await prisma.chatConversationMessage.findUnique({
      where: uniqueWhere,
      select: messageSelect,
    });

    if (!message) {
      try {
        message = await prisma.$transaction(async (tx) => {
          const created = (await tx.chatConversationMessage.create({
            data: {
              organizationId: organization.id,
              conversationId,
              senderId: user.id,
              body,
              clientMessageId,
              replyToId: replyToId || undefined,
              kind,
              metadata,
              attachments: attachmentResult.items.length
                ? {
                    create: attachmentResult.items.map((entry) => ({
                      type: entry.type as "IMAGE" | "VIDEO" | "FILE",
                      url: entry.url,
                      storagePath:
                        typeof entry.metadata?.path === "string" ? (entry.metadata.path as string) : undefined,
                      mime: entry.mime,
                      size: entry.size,
                      metadata: entry.metadata as Prisma.InputJsonValue,
                    })),
                  }
                : undefined,
            },
            select: messageSelect,
          })) as MessageWithRelations;

          if (preparedAssets.items.length) {
            await tx.mediaAsset.createMany({
              data: preparedAssets.items.map((asset) => ({
                organizationId: organization.id,
                ownerType: attachmentOwner.ownerType,
                ownerId: attachmentOwner.ownerId,
                uploadedByUserId: user.id,
                scope: "chat-attachment",
                bucket: asset.bucket,
                objectPath: asset.objectPath,
                mimeType: asset.mimeType,
                sizeBytes: asset.sizeBytes,
                checksumSha256: asset.checksumSha256,
                originalFilename: asset.originalFilename,
                isPublic: CHAT_ATTACHMENTS_PUBLIC,
              })),
              skipDuplicates: true,
            });
          }

          await tx.chatConversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: created.createdAt, lastMessageId: created.id },
          });

          await tx.chatConversationMember.update({
            where: { conversationId_userId: { conversationId, userId: user.id } },
            data: { lastReadMessageId: created.id, lastReadAt: created.createdAt },
          });

          return created;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          message = await prisma.chatConversationMessage.findUnique({
            where: uniqueWhere,
            select: messageSelect,
          });
          if (!message) {
            return jsonWrap({ ok: false, error: "DUPLICATE_MESSAGE" }, { status: 409 });
          }
        } else {
          throw err;
        }
      }
    }

    if (!message) {
      return jsonWrap({ ok: false, error: "MESSAGE_NOT_CREATED" }, { status: 500 });
    }

    const messageWithUrls = await resolveMessageAttachments(message);
    const messageForBroadcast = mapSenderForB2C(messageWithUrls, member);

    const warnings: string[] = [];
    try {
      await publishChatEvent({
        type: "message:new",
        organizationId: organization.id,
        conversationId,
        message: messageForBroadcast,
      });
    } catch (err) {
      warnings.push("REALTIME_DEGRADED");
      console.warn("[chat] falha a publicar mensagem em realtime", err);
    }

    const recipients = await prisma.chatConversationMember.findMany({
      where: {
        conversationId,
        userId: { not: user.id },
      },
      select: { userId: true, mutedUntil: true },
    });

    const now = new Date();
    const preview =
      buildPreview(message.body ?? null) || (message.attachments.length ? "Anexo" : "");

    try {
      if (!isChatRedisAvailable()) {
        console.warn("[chat] redis indisponível; a ignorar notificações offline.");
      } else {
        for (const recipient of recipients) {
          if (recipient.mutedUntil && recipient.mutedUntil > now) continue;
          const online = await isChatUserOnline(recipient.userId);
          if (online) continue;
          await enqueueNotification({
            dedupeKey: `chat_message:${message.id}:${recipient.userId}`,
            userId: recipient.userId,
            notificationType: "CHAT_MESSAGE",
            payload: {
              conversationId,
              messageId: message.id,
              senderId: user.id,
              preview,
              organizationId: organization.id,
            },
          });
        }
      }
    } catch (err) {
      if (!warnings.includes("REALTIME_DEGRADED")) {
        warnings.push("REALTIME_DEGRADED");
      }
      console.warn("[chat] falha em notificações offline", err);
    }

    return jsonWrap({
      ok: true,
      message: messageForBroadcast,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/messages error:", err);
    return jsonWrap({ ok: false, error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
