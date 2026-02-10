export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ChatConversationContextType } from "@prisma/client";

const ORG_CONTACT_CONTEXT_TYPES: ChatConversationContextType[] = [
  ChatConversationContextType.ORG_CONTACT,
  ChatConversationContextType.SERVICE,
];

async function _GET(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { organization } = await requireChatContext(req);

    const requests = await prisma.chatConversationRequest.findMany({
      where: {
        targetOrganizationId: organization.id,
        status: "PENDING",
        contextType: { in: ORG_CONTACT_CONTEXT_TYPES },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        contextType: true,
        contextId: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const serviceIds = requests
      .filter((item) => item.contextType === "SERVICE" && item.contextId)
      .map((item) => Number(item.contextId))
      .filter((id) => Number.isFinite(id));

    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds }, organizationId: organization.id },
          select: { id: true, title: true, coverImageUrl: true },
        })
      : [];
    const serviceMap = new Map(services.map((service) => [String(service.id), service]));

    const items = requests.map((item) => {
      const service = item.contextType === "SERVICE" && item.contextId ? serviceMap.get(item.contextId) : null;
      return {
        id: item.id,
        contextType: item.contextType,
        contextId: item.contextId,
        createdAt: item.createdAt.toISOString(),
        requester: item.requester,
        service: service
          ? { id: service.id, title: service.title, coverImageUrl: service.coverImageUrl ?? null }
          : null,
      };
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/chat/contact-requests error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar pedidos." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
