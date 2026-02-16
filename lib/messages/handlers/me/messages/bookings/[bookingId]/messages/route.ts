export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat/constants";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import {
  resolvePostingWindow,
  resolvePostingWindowStatus,
} from "@/lib/messages/postingWindow";
import { POST as postB2CConversationMessage } from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/messages/route";

const ADMIN_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN"]);

function resolveUserLabel(user: { fullName: string | null; username: string | null }) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Cliente");
}

async function _POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const bookingId = Number(context.params.bookingId ?? "");
    if (!Number.isFinite(bookingId)) {
      return jsonWrap({ error: "INVALID_BOOKING" }, { status: 400 });
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

    if (!booking || !booking.organizationId) {
      return jsonWrap({ error: "BOOKING_NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== user.id) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const posting = await resolvePostingWindow({
      contextType: "BOOKING",
      contextId: String(booking.id),
      organizationId: booking.organizationId,
    });
    if (!posting.canPost) {
      return jsonWrap({ error: posting.reason }, { status: resolvePostingWindowStatus(posting.reason) });
    }

    const payload = (await req.json().catch(() => null)) as {
      body?: unknown;
      clientMessageId?: unknown;
      attachments?: unknown;
    } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const hasAttachments = Array.isArray(payload?.attachments) && payload.attachments.length > 0;
    if (!body && !hasAttachments) {
      return jsonWrap({ error: "EMPTY_BODY" }, { status: 400 });
    }
    if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
      return jsonWrap({ error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    const customerProfile = await prisma.profile.findUnique({
      where: { id: user.id },
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
        customerId: user.id,
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
        organizationId: booking.organizationId,
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
        userId: user.id,
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
          organizationId: booking.organizationId,
        });
      }

      for (const member of orgMembers) {
        if (!ADMIN_ROLES.has(member.role) && member.userId !== user.id) continue;
        addMember({
          userId: member.userId,
          role: ADMIN_ROLES.has(member.role) ? "ADMIN" : "MEMBER",
          displayAs: "ORGANIZATION",
          hiddenFromCustomer: true,
          organizationId: booking.organizationId,
        });
      }

      try {
        conversation = await prisma.chatConversation.create({
          data: {
            organizationId: booking.organizationId,
            type: "CHANNEL",
            contextType: "BOOKING",
            contextId: String(booking.id),
            customerId: user.id,
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
            customerId: user.id,
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
        body,
        attachments: payload?.attachments,
        clientMessageId,
      }),
    });
    const delegatedResponse = await postB2CConversationMessage(delegatedReq, {
      params: { conversationId: conversation.id },
    });
    const delegatedJson = await delegatedResponse.clone().json().catch(() => null);
    if (delegatedResponse.ok && delegatedJson?.item) {
      return jsonWrap({
        conversationId: conversation.id,
        item: delegatedJson.item,
        ...(Array.isArray(delegatedJson.warnings) ? { warnings: delegatedJson.warnings } : {}),
      });
    }
    return delegatedResponse;
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/bookings/messages][post] error", err);
    return jsonWrap({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
