export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ChatConversationContextType, Prisma } from "@prisma/client";

const USER_DM_CONTEXT_ID = "USER_DM";
const ORG_CONTACT_CONTEXT_ID = "ORG_CONTACT";

function buildDmContextId(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

async function hasMutualFollow(userId: string, targetUserId: string) {
  const [a, b] = await Promise.all([
    prisma.follows.findFirst({ where: { follower_id: userId, following_id: targetUserId }, select: { follower_id: true } }),
    prisma.follows.findFirst({ where: { follower_id: targetUserId, following_id: userId }, select: { follower_id: true } }),
  ]);
  return Boolean(a && b);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const items = await prisma.chatConversationRequest.findMany({
      where: { targetUserId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        contextType: true,
        contextId: true,
        createdAt: true,
        requester: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    });

    return jsonWrap({ items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/requests] error", err);
    return jsonWrap({ error: "Erro ao carregar pedidos." }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as {
      targetUserId?: unknown;
      targetOrganizationId?: unknown;
      serviceId?: unknown;
    } | null;

    const targetUserId = typeof payload?.targetUserId === "string" ? payload.targetUserId.trim() : null;
    const targetOrganizationIdRaw = payload?.targetOrganizationId;
    const targetOrganizationId =
      typeof targetOrganizationIdRaw === "number"
        ? targetOrganizationIdRaw
        : Number.isFinite(Number(targetOrganizationIdRaw))
          ? Number(targetOrganizationIdRaw)
          : null;
    const serviceIdRaw = payload?.serviceId;
    const serviceId =
      typeof serviceIdRaw === "number"
        ? serviceIdRaw
        : Number.isFinite(Number(serviceIdRaw))
          ? Number(serviceIdRaw)
          : null;

    if (!targetUserId && !targetOrganizationId && !serviceId) {
      return jsonWrap({ error: "INVALID_TARGET" }, { status: 400 });
    }

    if (targetUserId && targetUserId === user.id) {
      return jsonWrap({ error: "INVALID_TARGET" }, { status: 400 });
    }

    if (targetUserId) {
      const dmContextId = buildDmContextId(user.id, targetUserId);
      const block = await prisma.chatUserBlock.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: user.id },
          ],
        },
        select: { id: true },
      });
      if (block) {
        return jsonWrap({ error: "CHAT_BLOCKED" }, { status: 403 });
      }

      const existing = await prisma.chatConversation.findFirst({
        where: {
          organizationId: null,
          contextType: ChatConversationContextType.USER_DM,
          contextId: dmContextId,
        },
        select: { id: true },
      });
      if (existing) {
        return jsonWrap({ ok: true, conversationId: existing.id });
      }

      const mutual = await hasMutualFollow(user.id, targetUserId);
      if (mutual) {
        let conversation: { id: string } | null = null;
        try {
          conversation = await prisma.chatConversation.create({
            data: {
              organizationId: null,
              type: "DIRECT",
              contextType: ChatConversationContextType.USER_DM,
              contextId: dmContextId,
              createdByUserId: user.id,
              members: {
                create: [
                  { userId: user.id, role: "MEMBER" },
                  { userId: targetUserId, role: "MEMBER" },
                ],
              },
            },
            select: { id: true },
          });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
            throw err;
          }
          const existingAfterConflict = await prisma.chatConversation.findFirst({
            where: {
              organizationId: null,
              contextType: ChatConversationContextType.USER_DM,
              contextId: dmContextId,
            },
            select: { id: true },
          });
          if (!existingAfterConflict) {
            throw err;
          }
          conversation = existingAfterConflict;
        }
        return jsonWrap({ ok: true, conversationId: conversation.id });
      }

      const pending = await prisma.chatConversationRequest.findFirst({
        where: {
          requesterId: user.id,
          targetUserId,
          contextType: ChatConversationContextType.USER_DM,
          contextId: USER_DM_CONTEXT_ID,
          status: "PENDING",
        },
        select: { id: true, status: true, createdAt: true },
      });
      if (pending) {
        return jsonWrap({ ok: true, request: pending });
      }

      let result: { conversationId: string } | { request: { id: string; status: string; createdAt: Date } };
      try {
        result = await prisma.$transaction(async (tx) => {
          const inverse = await tx.chatConversationRequest.findFirst({
            where: {
              requesterId: targetUserId,
              targetUserId: user.id,
              contextType: ChatConversationContextType.USER_DM,
              contextId: USER_DM_CONTEXT_ID,
              status: "PENDING",
            },
            select: { id: true },
          });

          if (inverse) {
            const now = new Date();
            let conversation = await tx.chatConversation.findFirst({
              where: {
                organizationId: null,
                contextType: ChatConversationContextType.USER_DM,
                contextId: dmContextId,
              },
              select: { id: true },
            });
            if (!conversation) {
              try {
                conversation = await tx.chatConversation.create({
                  data: {
                    organizationId: null,
                    type: "DIRECT",
                    contextType: ChatConversationContextType.USER_DM,
                    contextId: dmContextId,
                    createdByUserId: user.id,
                    members: {
                      create: [
                        { userId: user.id, role: "MEMBER" },
                        { userId: targetUserId, role: "MEMBER" },
                      ],
                    },
                  },
                  select: { id: true },
                });
              } catch (err) {
                if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
                  throw err;
                }
                const existingAfterConflict = await tx.chatConversation.findFirst({
                  where: {
                    organizationId: null,
                    contextType: ChatConversationContextType.USER_DM,
                    contextId: dmContextId,
                  },
                  select: { id: true },
                });
                if (!existingAfterConflict) {
                  throw err;
                }
                conversation = existingAfterConflict;
              }
            }

            await tx.chatConversationRequest.update({
              where: { id: inverse.id },
              data: {
                status: "ACCEPTED",
                conversationId: conversation.id,
                resolvedAt: now,
                updatedAt: now,
              },
            });

            await tx.chatConversationRequest.create({
              data: {
                requesterId: user.id,
                targetUserId,
                contextType: ChatConversationContextType.USER_DM,
                contextId: USER_DM_CONTEXT_ID,
                status: "ACCEPTED",
                conversationId: conversation.id,
                resolvedAt: now,
              },
              select: { id: true },
            });

            return { conversationId: conversation.id };
          }

          const request = await tx.chatConversationRequest.create({
            data: {
              requesterId: user.id,
              targetUserId,
              contextType: ChatConversationContextType.USER_DM,
              contextId: USER_DM_CONTEXT_ID,
            },
            select: { id: true, status: true, createdAt: true },
          });

          return { request };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existingConversation = await prisma.chatConversation.findFirst({
            where: {
              organizationId: null,
              contextType: ChatConversationContextType.USER_DM,
              contextId: dmContextId,
            },
            select: { id: true },
          });
          if (existingConversation) {
            return jsonWrap({ ok: true, conversationId: existingConversation.id });
          }
          const existingPending = await prisma.chatConversationRequest.findFirst({
            where: {
              requesterId: user.id,
              targetUserId,
              contextType: ChatConversationContextType.USER_DM,
              contextId: USER_DM_CONTEXT_ID,
              status: "PENDING",
            },
            select: { id: true, status: true, createdAt: true },
          });
          if (existingPending) {
            return jsonWrap({ ok: true, request: existingPending });
          }
        }
        throw err;
      }

      if ("conversationId" in result) {
        return jsonWrap({ ok: true, conversationId: result.conversationId });
      }
      return jsonWrap({ ok: true, request: result.request });
    }

    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, organizationId: true, isActive: true, instructorId: true },
      });
      if (!service || !service.organizationId) {
        return jsonWrap({ error: "SERVICE_NOT_FOUND" }, { status: 404 });
      }

      const existing = await prisma.chatConversation.findFirst({
        where: {
          organizationId: service.organizationId,
          contextType: ChatConversationContextType.SERVICE,
          contextId: String(service.id),
          customerId: user.id,
        },
        select: { id: true },
      });

      if (existing) {
        return jsonWrap({ ok: true, conversationId: existing.id });
      }

      const pending = await prisma.chatConversationRequest.findFirst({
        where: {
          requesterId: user.id,
          targetOrganizationId: service.organizationId,
          contextType: ChatConversationContextType.SERVICE,
          contextId: String(service.id),
          status: "PENDING",
        },
        select: { id: true, status: true, createdAt: true },
      });
      if (pending) {
        return jsonWrap({ ok: true, request: pending });
      }

      try {
        const request = await prisma.chatConversationRequest.create({
          data: {
            requesterId: user.id,
            targetOrganizationId: service.organizationId,
            contextType: ChatConversationContextType.SERVICE,
            contextId: String(service.id),
          },
          select: { id: true, status: true, createdAt: true },
        });

        return jsonWrap({ ok: true, request });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existingPending = await prisma.chatConversationRequest.findFirst({
            where: {
              requesterId: user.id,
              targetOrganizationId: service.organizationId,
              contextType: ChatConversationContextType.SERVICE,
              contextId: String(service.id),
              status: "PENDING",
            },
            select: { id: true, status: true, createdAt: true },
          });
          if (existingPending) {
            return jsonWrap({ ok: true, request: existingPending });
          }
        }
        throw err;
      }
    }

    if (targetOrganizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: targetOrganizationId },
        select: { id: true },
      });
      if (!organization) {
        return jsonWrap({ error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
      }

      const existing = await prisma.chatConversation.findFirst({
        where: {
          organizationId: targetOrganizationId,
          contextType: ChatConversationContextType.ORG_CONTACT,
          customerId: user.id,
        },
        select: { id: true },
      });

      if (existing) {
        return jsonWrap({ ok: true, conversationId: existing.id });
      }

      const pending = await prisma.chatConversationRequest.findFirst({
        where: {
          requesterId: user.id,
          targetOrganizationId,
          contextType: ChatConversationContextType.ORG_CONTACT,
          contextId: ORG_CONTACT_CONTEXT_ID,
          status: "PENDING",
        },
        select: { id: true, status: true, createdAt: true },
      });

      if (pending) {
        return jsonWrap({ ok: true, request: pending });
      }

      try {
        const request = await prisma.chatConversationRequest.create({
          data: {
            requesterId: user.id,
            targetOrganizationId,
            contextType: ChatConversationContextType.ORG_CONTACT,
            contextId: ORG_CONTACT_CONTEXT_ID,
          },
          select: { id: true, status: true, createdAt: true },
        });

        return jsonWrap({ ok: true, request });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existingPending = await prisma.chatConversationRequest.findFirst({
            where: {
              requesterId: user.id,
              targetOrganizationId,
              contextType: ChatConversationContextType.ORG_CONTACT,
              contextId: ORG_CONTACT_CONTEXT_ID,
              status: "PENDING",
            },
            select: { id: true, status: true, createdAt: true },
          });
          if (existingPending) {
            return jsonWrap({ ok: true, request: existingPending });
          }
        }
        throw err;
      }
    }

    return jsonWrap({ error: "INVALID_TARGET" }, { status: 400 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/requests][post] error", err);
    return jsonWrap({ error: "Erro ao criar pedido." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
