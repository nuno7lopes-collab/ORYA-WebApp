export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import {
  isChatRedisAvailable,
  isChatRedisUnavailableError,
  isChatUserOnline,
  publishChatEvent,
} from "@/lib/chat/redis";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { OrganizationMemberRole } from "@prisma/client";
import crypto from "crypto";

const ADMIN_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

function resolveUserLabel(user: { fullName: string | null; username: string | null }) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Cliente");
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
  organization?: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
  } | null;
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

async function _POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);

    const bookingId = Number(context.params.bookingId ?? "");
    if (!Number.isFinite(bookingId)) {
      return jsonWrap({ ok: false, error: "INVALID_BOOKING" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        userId: true,
        startsAt: true,
        durationMinutes: true,
        professional: { select: { userId: true } },
      },
    });

    if (!booking || booking.organizationId !== organization.id) {
      return jsonWrap({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
    }

    if (!booking.userId) {
      return jsonWrap({ ok: false, error: "BOOKING_NO_CUSTOMER" }, { status: 400 });
    }

    if (!["CONFIRMED", "COMPLETED"].includes(booking.status)) {
      return jsonWrap({ ok: false, error: "BOOKING_INACTIVE" }, { status: 403 });
    }

    if (!booking.startsAt || !Number.isFinite(booking.durationMinutes)) {
      return jsonWrap({ ok: false, error: "BOOKING_INVALID" }, { status: 400 });
    }
    const endAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const closeAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
    if (Date.now() > closeAt.getTime()) {
      return jsonWrap({ ok: false, error: "READ_ONLY" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown; clientMessageId?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body) {
      return jsonWrap({ ok: false, error: "EMPTY_BODY" }, { status: 400 });
    }
    if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ ok: false, error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    const customerProfile = await prisma.profile.findUnique({
      where: { id: booking.userId },
      select: { fullName: true, username: true },
    });
    const customerLabel = resolveUserLabel({
      fullName: customerProfile?.fullName ?? null,
      username: customerProfile?.username ?? null,
    });

    const professionalId = booking.professional?.userId ?? null;

    let conversation = await prisma.chatConversation.findFirst({
      where: {
        organizationId: booking.organizationId,
        contextType: "BOOKING",
        contextId: String(booking.id),
        customerId: booking.userId,
      },
      include: {
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
    });

    if (!conversation) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId: organization.id },
        select: { userId: true, role: true },
      });

      const memberMap = new Map<
        string,
        {
          userId: string;
          role: "MEMBER" | "ADMIN";
          displayAs: "ORGANIZATION" | "PROFESSIONAL";
          hiddenFromCustomer: boolean;
          organizationId: number | null;
        }
      >();

      const addMember = (entry: {
        userId: string;
        role: "MEMBER" | "ADMIN";
        displayAs: "ORGANIZATION" | "PROFESSIONAL";
        hiddenFromCustomer: boolean;
        organizationId: number | null;
      }) => {
        const existingEntry = memberMap.get(entry.userId);
        if (!existingEntry) {
          memberMap.set(entry.userId, entry);
          return;
        }
        if (existingEntry.role !== "ADMIN" && entry.role === "ADMIN") {
          existingEntry.role = "ADMIN";
        }
        if (!existingEntry.hiddenFromCustomer && entry.hiddenFromCustomer) {
          existingEntry.hiddenFromCustomer = true;
        }
        if (existingEntry.displayAs !== "PROFESSIONAL" && entry.displayAs === "PROFESSIONAL") {
          existingEntry.displayAs = "PROFESSIONAL";
        }
      };

      addMember({
        userId: booking.userId,
        role: "MEMBER",
        displayAs: "ORGANIZATION",
        hiddenFromCustomer: false,
        organizationId: null,
      });

      if (professionalId) {
        addMember({
          userId: professionalId,
          role: "MEMBER",
          displayAs: "PROFESSIONAL",
          hiddenFromCustomer: false,
          organizationId: organization.id,
        });
      }

      for (const member of orgMembers) {
        if (!ADMIN_ROLES.has(member.role) && member.userId !== user.id) continue;
        addMember({
          userId: member.userId,
          role: ADMIN_ROLES.has(member.role) ? "ADMIN" : "MEMBER",
          displayAs: "ORGANIZATION",
          hiddenFromCustomer: true,
          organizationId: organization.id,
        });
      }

      conversation = await prisma.chatConversation.create({
        data: {
          organizationId: organization.id,
          type: "CHANNEL",
          contextType: "BOOKING",
          contextId: String(booking.id),
          customerId: booking.userId,
          professionalId,
          title: customerLabel,
          createdByUserId: user.id,
          members: {
            create: Array.from(memberMap.values()).map((entry) => ({
              userId: entry.userId,
              role: entry.role,
              organizationId: entry.organizationId,
              displayAs: entry.displayAs,
              hiddenFromCustomer: entry.hiddenFromCustomer,
            })),
          },
        },
        include: {
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
      });
    }

    const clientMessageId =
      typeof payload?.clientMessageId === "string" && payload.clientMessageId.trim().length > 0
        ? payload.clientMessageId.trim()
        : crypto.randomUUID();

    const message = await prisma.chatConversationMessage.create({
      data: {
        conversationId: conversation.id,
        organizationId: conversation.organizationId,
        senderId: user.id,
        body,
        clientMessageId,
        kind: "TEXT",
      },
      select: { id: true, body: true, createdAt: true, deletedAt: true, senderId: true },
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt, lastMessageId: message.id },
    });

    const viewerIsCustomer = true;
    const members = conversation.members;

    await publishChatEvent({
      type: "message:new",
      organizationId: conversation.organizationId ?? undefined,
      conversationId: conversation.id,
      message: {
        id: message.id,
        conversationId: conversation.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        deletedAt: null,
        sender: mapSenderDisplay({
          senderId: message.senderId,
          members,
          viewerIsCustomer,
          organization: conversation.organization ?? organization,
        }),
      },
    });

    const recipients = await prisma.chatConversationMember.findMany({
      where: { conversationId: conversation.id, userId: { not: user.id } },
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
            conversationId: conversation.id,
            messageId: message.id,
            senderId: user.id,
            preview,
            organizationId: conversation.organizationId ?? null,
            contextType: conversation.contextType,
          },
        });
      }
    }

    return jsonWrap({
      ok: true,
      conversationId: conversation.id,
      item: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        deletedAt: null,
        sender: mapSenderDisplay({
          senderId: message.senderId,
          members,
          viewerIsCustomer,
          organization: conversation.organization ?? organization,
        }),
      },
    });
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
    console.error("POST /api/chat/bookings/messages error:", err);
    return jsonWrap({ ok: false, error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
