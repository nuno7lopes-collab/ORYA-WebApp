export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import crypto from "crypto";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import {
  resolvePostingWindow,
  resolvePostingWindowStatus,
} from "@/lib/messages/postingWindow";
import { POST as postOrgMessage } from "@/lib/messages/handlers/chat/messages/route";

const ADMIN_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

function resolveUserLabel(user: { fullName: string | null; username: string | null }) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Cliente");
}

async function _POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {

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

    const posting = await resolvePostingWindow({
      contextType: "BOOKING",
      contextId: String(booking.id),
      organizationId: booking.organizationId,
    });
    if (!posting.canPost) {
      return jsonWrap({ ok: false, error: posting.reason }, { status: resolvePostingWindowStatus(posting.reason) });
    }

    const payload = (await req.json().catch(() => null)) as {
      body?: unknown;
      clientMessageId?: unknown;
      attachments?: unknown;
    } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const hasAttachments = Array.isArray(payload?.attachments) && payload.attachments.length > 0;
    if (!body && !hasAttachments) {
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
      const orgMembers = await listEffectiveOrganizationMembers({
        organizationId: organization.id,
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

      try {
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
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        const existing = await prisma.chatConversation.findFirst({
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
        if (!existing) {
          throw err;
        }
        conversation = existing;
      }
    }

    const clientMessageId =
      typeof payload?.clientMessageId === "string" && payload.clientMessageId.trim().length > 0
        ? payload.clientMessageId.trim()
        : crypto.randomUUID();
    const delegatedHeaders = new Headers(req.headers);
    delegatedHeaders.set("content-type", "application/json");
    delegatedHeaders.delete("content-length");

    const delegatedReq = new NextRequest(req.url, {
      method: req.method,
      headers: delegatedHeaders,
      body: JSON.stringify({
        conversationId: conversation.id,
        body,
        attachments: payload?.attachments,
        clientMessageId,
      }),
    });
    const delegatedResponse = await postOrgMessage(delegatedReq);
    const delegatedJson = await delegatedResponse.clone().json().catch(() => null);
    if (delegatedResponse.ok && delegatedJson?.message) {
      return jsonWrap({
        ok: true,
        conversationId: conversation.id,
        item: delegatedJson.message,
        ...(Array.isArray(delegatedJson.warnings) ? { warnings: delegatedJson.warnings } : {}),
      });
    }
    return delegatedResponse;
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/bookings/messages error:", err);
    return jsonWrap({ ok: false, error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
