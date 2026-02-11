export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { isChatRedisUnavailableError, publishChatEvent } from "@/lib/chat/redis";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ADMIN_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

function resolveUserLabel(user: { fullName: string | null; username: string | null }) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Cliente");
}

async function _POST(req: NextRequest, context: { params: { requestId: string } }) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);

    const requestId = typeof context.params.requestId === "string" ? context.params.requestId.trim() : "";
    if (!requestId) {
      return jsonWrap({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const request = await prisma.chatConversationRequest.findFirst({
      where: {
        id: requestId,
        targetOrganizationId: organization.id,
        status: "PENDING",
        contextType: { in: ["ORG_CONTACT", "SERVICE"] },
      },
      select: {
        id: true,
        requesterId: true,
        contextType: true,
        contextId: true,
        requester: { select: { fullName: true, username: true } },
      },
    });

    if (!request) {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }

    let service: { id: number; title: string | null; instructorId: string | null } | null = null;
    if (request.contextType === "SERVICE") {
      const serviceId = Number(request.contextId ?? "");
      if (!Number.isFinite(serviceId)) {
        return jsonWrap({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
      }
      service = await prisma.service.findFirst({
        where: { id: serviceId, organizationId: organization.id },
        select: { id: true, title: true, instructorId: true },
      });
      if (!service) {
        return jsonWrap({ ok: false, error: "SERVICE_NOT_FOUND" }, { status: 404 });
      }
    }

    const existing = await prisma.chatConversation.findFirst({
      where: {
        organizationId: organization.id,
        contextType: request.contextType,
        contextId: request.contextId ?? null,
        customerId: request.requesterId,
      },
      select: { id: true },
    });

    const customerLabel = resolveUserLabel(request.requester);
    const title = customerLabel;
    const professionalId = service?.instructorId ?? null;

    let conversationId = existing?.id ?? null;

    if (!conversationId) {
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
        userId: request.requesterId,
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

      if (memberMap.size === 0) {
        return jsonWrap({ ok: false, error: "NO_MEMBERS" }, { status: 400 });
      }

      try {
        const conversation = await prisma.chatConversation.create({
          data: {
            organizationId: organization.id,
            type: "CHANNEL",
            contextType: request.contextType,
            contextId: request.contextId ?? null,
            customerId: request.requesterId,
            professionalId,
            title,
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
          select: { id: true },
        });
        conversationId = conversation.id;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        const existingAfterConflict = await prisma.chatConversation.findFirst({
          where: {
            organizationId: organization.id,
            contextType: request.contextType,
            contextId: request.contextId ?? null,
            customerId: request.requesterId,
          },
          select: { id: true },
        });
        if (!existingAfterConflict) {
          throw err;
        }
        conversationId = existingAfterConflict.id;
      }
    }

    await prisma.chatConversationRequest.update({
      where: { id: request.id },
      data: {
        status: "ACCEPTED",
        resolvedAt: new Date(),
        conversationId: conversationId ?? undefined,
        updatedAt: new Date(),
      },
    });

    if (conversationId) {
      await publishChatEvent({
        type: "conversation:update",
        action: "created",
        organizationId: organization.id,
        conversationId,
      });
    }

    return jsonWrap({ ok: true, conversationId });
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
    console.error("POST /api/chat/contact-requests/approve error:", err);
    return jsonWrap({ ok: false, error: "Erro ao aprovar pedido." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
