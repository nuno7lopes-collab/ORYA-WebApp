export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  CHAT_MAX_ATTACHMENT_BYTES,
  CHAT_MAX_ATTACHMENTS,
  CHAT_MESSAGE_MAX_LENGTH,
} from "@/lib/chat/constants";
import {
  isChatRedisAvailable,
  isChatUserOnline,
  publishChatEvent,
} from "@/lib/chat/redis";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { ChatConversationContextType, MediaOwnerType, Prisma } from "@prisma/client";
import {
  resolvePostingWindow,
  resolvePostingWindowStatus,
} from "@/lib/messages/postingWindow";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const B2C_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.EVENT,
  ChatConversationContextType.USER_DM,
  ChatConversationContextType.USER_GROUP,
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.BOOKING,
  ChatConversationContextType.SERVICE,
];
const CHAT_ATTACHMENTS_PUBLIC = process.env.CHAT_ATTACHMENTS_PUBLIC === "true";

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

function isExternalAttachmentUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("https://") || normalized.startsWith("http://");
}

function canExposeAttachment(metadata: Record<string, unknown>) {
  const scanStatusRaw =
    typeof metadata.scanStatus === "string"
      ? metadata.scanStatus
      : typeof metadata.scan_state === "string"
        ? metadata.scan_state
        : null;
  const dlpStatusRaw =
    typeof metadata.dlpStatus === "string"
      ? metadata.dlpStatus
      : typeof metadata.dlp_status === "string"
        ? metadata.dlp_status
        : null;
  const scanStatus = scanStatusRaw?.trim().toLowerCase() ?? "ready";
  const dlpStatus = dlpStatusRaw?.trim().toLowerCase() ?? "passed";
  const blocked = metadata.blocked === true || metadata.rejected === true;

  if (blocked) return false;
  if (dlpStatus === "rejected" || dlpStatus === "blocked") return false;
  if (scanStatus === "rejected" || scanStatus === "blocked") return false;
  if (scanStatus === "pending_scan" || scanStatus === "pending") return false;
  return true;
}

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
      if (!isExternalAttachmentUrl(entry.url)) {
        return { ok: false as const, error: "ATTACHMENT_METADATA_REQUIRED" };
      }
      continue;
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
          if (!canExposeAttachment(metadata)) {
            return { ...attachment, url: "" };
          }
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

function mapSenderDisplay(params: {
  senderId: string | null;
  members: Array<{
    userId: string;
    displayAs: "ORGANIZATION" | "PROFESSIONAL";
    user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null };
  }>;
  viewerIsCustomer: boolean;
  viewerId?: string | null;
  organization?: { id: number; publicName: string | null; businessName: string | null; username: string | null; brandingAvatarUrl: string | null } | null;
}) {
  if (!params.senderId) return null;
  const member = params.members.find((m) => m.userId === params.senderId);
  if (!member) return null;
  if (params.viewerId && params.senderId === params.viewerId) {
    return {
      id: member.user.id,
      fullName: member.user.fullName,
      username: member.user.username,
      avatarUrl: member.user.avatarUrl,
    };
  }
  if (params.viewerIsCustomer && member.displayAs === "ORGANIZATION" && params.organization) {
    const orgName = params.organization.publicName || params.organization.businessName || "Organização";
    return {
      id: `org:${params.organization.id}`,
      fullName: orgName,
      username: params.organization.username ?? null,
      avatarUrl: params.organization.brandingAvatarUrl ?? null,
    };
  }
  return {
    id: member.user.id,
    fullName: member.user.fullName,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
  };
}

async function _GET(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const conversationId = context.params.conversationId;

    const membershipQuery = {
      where: {
        conversationId,
        userId: user.id,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            title: true,
            contextType: true,
            contextId: true,
            organizationId: true,
            customerId: true,
            professionalId: true,
            createdAt: true,
            organization: {
              select: { id: true, publicName: true, businessName: true, username: true, brandingAvatarUrl: true },
            },
            members: {
              select: {
                userId: true,
                displayAs: true,
                hiddenFromCustomer: true,
                user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    } satisfies Prisma.ChatConversationMemberFindFirstArgs;

    const membership = await prisma.chatConversationMember.findFirst(membershipQuery);

    if (!membership?.conversation) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const conversation = membership.conversation;
    const viewerIsCustomer = conversation.customerId === user.id;
    const allMembers = conversation.members;
    const members = viewerIsCustomer
      ? allMembers.filter((member) => !member.hiddenFromCustomer || member.userId === user.id)
      : allMembers;

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));
    const after = decodeCursor(req.nextUrl.searchParams.get("after"));

    if (after) {
      const items = await prisma.chatConversationMessage.findMany({
        where: {
          conversationId,
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
          createdAt: true,
          deletedAt: true,
          senderId: true,
          attachments: true,
        },
      });
      const resolvedItems = await resolveAttachmentUrls(items);

      const latest = items.length > 0 ? encodeCursor(items[items.length - 1]) : null;

      return jsonWrap({
        conversation: {
          id: conversation.id,
          type: conversation.type,
          title: conversation.title,
          contextType: conversation.contextType,
          contextId: conversation.contextId,
          organizationId: conversation.organizationId,
          customerId: conversation.customerId,
          professionalId: conversation.professionalId,
        },
        members: members.map((member) => ({
          userId: member.userId,
          displayAs: member.displayAs,
          fullName: member.user.fullName,
          username: member.user.username,
          avatarUrl: member.user.avatarUrl,
        })),
        items: resolvedItems.map((item) => ({
          id: item.id,
          body: item.deletedAt ? null : item.body,
          createdAt: item.createdAt.toISOString(),
          deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
          attachments: item.deletedAt ? [] : item.attachments,
          sender: mapSenderDisplay({
            senderId: item.senderId,
            members: allMembers,
            viewerIsCustomer,
            viewerId: user.id,
            organization: conversation.organization,
          }),
        })),
        latestCursor: latest,
      });
    }

    const items = await prisma.chatConversationMessage.findMany({
      where: {
        conversationId,
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
        createdAt: true,
        deletedAt: true,
        senderId: true,
        attachments: true,
      },
    });

    const ordered = items.slice().reverse();
    const resolvedOrdered = await resolveAttachmentUrls(ordered);
    const nextCursor = items.length === limit ? encodeCursor(items[items.length - 1]) : null;
    const latestCursor = ordered.length > 0 ? encodeCursor(ordered[ordered.length - 1]) : null;

    const posting = await resolvePostingWindow({
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      organizationId: conversation.organizationId,
    });

    return jsonWrap({
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        contextType: conversation.contextType,
        contextId: conversation.contextId,
        organizationId: conversation.organizationId,
        customerId: conversation.customerId,
        professionalId: conversation.professionalId,
      },
      members: members.map((member) => ({
        userId: member.userId,
        displayAs: member.displayAs,
        fullName: member.user.fullName,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
      })),
      canPost: posting.canPost,
      readOnlyReason: posting.canPost ? null : posting.reason ?? "READ_ONLY",
      items: resolvedOrdered.map((item) => ({
        id: item.id,
        body: item.deletedAt ? null : item.body,
        createdAt: item.createdAt.toISOString(),
        deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
        attachments: item.deletedAt ? [] : item.attachments,
        sender: mapSenderDisplay({
          senderId: item.senderId,
          members: allMembers,
          viewerIsCustomer,
          viewerId: user.id,
          organization: conversation.organization,
        }),
      })),
      nextCursor,
      latestCursor,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/conversations/messages] error", err);
    return jsonWrap({ error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, context: { params: { conversationId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const conversationId = context.params.conversationId;

    const membershipQuery = {
      where: {
        conversationId,
        userId: user.id,
        conversation: { contextType: { in: B2C_CONTEXT_TYPES } },
      },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            contextType: true,
            contextId: true,
            organizationId: true,
            customerId: true,
            professionalId: true,
            organization: {
              select: { id: true, publicName: true, businessName: true, username: true, brandingAvatarUrl: true },
            },
            members: {
              select: {
                userId: true,
                displayAs: true,
                hiddenFromCustomer: true,
                user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    } satisfies Prisma.ChatConversationMemberFindFirstArgs;

    const membership = await prisma.chatConversationMember.findFirst(membershipQuery);

    if (!membership?.conversation) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const conversation = membership.conversation;

    const payload = (await req.json().catch(() => null)) as {
      body?: unknown;
      clientMessageId?: unknown;
      attachments?: unknown;
    } | null;
    const attachmentResult = normalizeAttachments(payload?.attachments);
    if (!attachmentResult.ok) {
      return jsonWrap({ error: attachmentResult.error }, { status: 400 });
    }
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body && attachmentResult.items.length === 0) {
      return jsonWrap({ error: "EMPTY_BODY" }, { status: 400 });
    }
    if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }
    const preparedAssets = await prepareAttachmentAssets(attachmentResult.items);
    if (!preparedAssets.ok) {
      return jsonWrap({ error: preparedAssets.error }, { status: 400 });
    }

    const posting = await resolvePostingWindow({
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      organizationId: conversation.organizationId,
    });
    if (!posting.canPost) {
      return jsonWrap(
        { error: posting.reason ?? "READ_ONLY" },
        { status: resolvePostingWindowStatus(posting.reason) },
      );
    }

    const clientMessageId =
      typeof payload?.clientMessageId === "string" ? payload.clientMessageId.trim() : "";
    if (!clientMessageId) {
      return jsonWrap({ error: "INVALID_CLIENT_MESSAGE_ID" }, { status: 400 });
    }

    const messageSelect = {
      id: true,
      body: true,
      createdAt: true,
      deletedAt: true,
      senderId: true,
      attachments: true,
    } as const;

    const uniqueWhere = {
      conversationId_senderId_clientMessageId: {
        conversationId,
        senderId: user.id,
        clientMessageId,
      },
    };

    let message = await prisma.chatConversationMessage.findUnique({
      where: uniqueWhere,
      select: messageSelect,
    });

    if (!message) {
      const attachmentOwner =
        conversation.type === "CHANNEL"
          ? { ownerType: MediaOwnerType.ORGANIZATION, ownerId: String(conversation.organizationId) }
          : { ownerType: MediaOwnerType.USER, ownerId: user.id };
      try {
        message = await prisma.$transaction(async (tx) => {
          const created = await tx.chatConversationMessage.create({
            data: {
              conversationId,
              organizationId: conversation.organizationId,
              senderId: user.id,
              body: body || null,
              clientMessageId,
              kind: "TEXT",
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
          });

          if (preparedAssets.items.length) {
            await tx.mediaAsset.createMany({
              data: preparedAssets.items.map((asset) => ({
                organizationId: conversation.organizationId,
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
            return jsonWrap({ error: "DUPLICATE_MESSAGE" }, { status: 409 });
          }
        } else {
          throw err;
        }
      }
    }

    if (!message) {
      return jsonWrap({ error: "MESSAGE_NOT_CREATED" }, { status: 500 });
    }
    const [messageWithUrls] = await resolveAttachmentUrls([message]);

    const viewerIsCustomer = conversation.customerId === user.id;
    const members = conversation.members;

    const recipients = await prisma.chatConversationMember.findMany({
      where: { conversationId, userId: { not: user.id } },
      select: { userId: true, mutedUntil: true },
    });

    const now = new Date();
    const preview =
      body.length > 0 ? (body.length > 160 ? `${body.slice(0, 157)}…` : body) : "Anexo";
    const warnings: string[] = [];

    try {
      await publishChatEvent({
        type: "message:new",
        organizationId: conversation.organizationId ?? undefined,
        conversationId,
        message: {
          id: messageWithUrls.id,
          conversationId,
          body: messageWithUrls.body,
          createdAt: messageWithUrls.createdAt.toISOString(),
          deletedAt: messageWithUrls.deletedAt ? messageWithUrls.deletedAt.toISOString() : null,
          attachments: messageWithUrls.attachments,
          sender: mapSenderDisplay({
            senderId: messageWithUrls.senderId,
            members,
            viewerIsCustomer,
            viewerId: user.id,
            organization: conversation.organization,
          }),
        },
      });
    } catch (err) {
      warnings.push("REALTIME_DEGRADED");
      console.warn("[api/me/messages/conversations/messages][post] realtime degraded", err);
    }

    try {
      if (isChatRedisAvailable()) {
        for (const recipient of recipients) {
          if (recipient.mutedUntil && recipient.mutedUntil > now) continue;
          const online = await isChatUserOnline(recipient.userId);
          if (online) continue;
          await enqueueNotification({
            dedupeKey: `chat_message:${messageWithUrls.id}:${recipient.userId}`,
            userId: recipient.userId,
            notificationType: "CHAT_MESSAGE",
            payload: {
              conversationId,
              messageId: messageWithUrls.id,
              senderId: user.id,
              preview,
              organizationId: conversation.organizationId ?? null,
              contextType: conversation.contextType,
            },
          });
        }
      }
    } catch (err) {
      if (!warnings.includes("REALTIME_DEGRADED")) {
        warnings.push("REALTIME_DEGRADED");
      }
      console.warn("[api/me/messages/conversations/messages][post] offline notifications degraded", err);
    }

    return jsonWrap({
      item: {
        id: messageWithUrls.id,
        body: messageWithUrls.body,
        createdAt: messageWithUrls.createdAt.toISOString(),
        deletedAt: messageWithUrls.deletedAt ? messageWithUrls.deletedAt.toISOString() : null,
        attachments: messageWithUrls.attachments,
        sender: mapSenderDisplay({
          senderId: messageWithUrls.senderId,
          members,
          viewerIsCustomer,
          viewerId: user.id,
          organization: conversation.organization,
        }),
      },
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/conversations/messages][post] error", err);
    return jsonWrap({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
