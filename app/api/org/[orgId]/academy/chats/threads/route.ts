import { NextRequest } from "next/server";
import { ChatConversationContextType, ChatConversationMemberRole, ChatConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

function parsePositiveInt(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function _POST(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const classId = parsePositiveInt(body.classId);
  const sessionId = parsePositiveInt(body.sessionId);
  const providedConversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";

  if (!classId && !sessionId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Indica classId ou sessionId.", retryable: false },
      { status: 400 },
    );
  }

  let resolvedClassId = classId;
  if (sessionId) {
    const session = await prisma.classSession.findFirst({
      where: {
        id: sessionId,
        organizationId: access.organization.id,
        service: { kind: "CLASS" },
      },
      select: {
        id: true,
        serviceId: true,
      },
    });

    if (!session) {
      return respondError(
        access.ctx,
        { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
        { status: 404 },
      );
    }

    if (resolvedClassId && resolvedClassId !== session.serviceId) {
      return respondError(
        access.ctx,
        {
          errorCode: "BAD_REQUEST",
          message: "A sessão não pertence à aula indicada.",
          retryable: false,
        },
        { status: 400 },
      );
    }

    resolvedClassId = session.serviceId;
  }

  if (!resolvedClassId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Não foi possível resolver a aula.", retryable: false },
      { status: 400 },
    );
  }

  const academyClass = await prisma.service.findFirst({
    where: {
      id: resolvedClassId,
      organizationId: access.organization.id,
      kind: "CLASS",
    },
    select: { id: true, title: true },
  });

  if (!academyClass) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Aula não encontrada.", retryable: false },
      { status: 404 },
    );
  }

  let conversationId = providedConversationId;
  if (conversationId) {
    const existingConversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        organizationId: access.organization.id,
      },
      select: { id: true },
    });

    if (!existingConversation) {
      return respondError(
        access.ctx,
        { errorCode: "NOT_FOUND", message: "Thread de chat não encontrada.", retryable: false },
        { status: 404 },
      );
    }
  } else {
    const createdConversation = await prisma.chatConversation.create({
      data: {
        organizationId: access.organization.id,
        type: ChatConversationType.GROUP,
        contextType: ChatConversationContextType.SERVICE,
        contextId: sessionId ? `academy:session:${sessionId}` : `academy:class:${resolvedClassId}`,
        title: sessionId
          ? `${academyClass.title || "Aula"} · Sessão #${sessionId}`
          : academyClass.title || "Turma da academia",
        createdByUserId: access.profile.id,
      },
      select: { id: true },
    });

    conversationId = createdConversation.id;

    await prisma.chatConversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: access.profile.id,
        },
      },
      create: {
        conversationId,
        organizationId: access.organization.id,
        userId: access.profile.id,
        role: ChatConversationMemberRole.ADMIN,
      },
      update: {
        leftAt: null,
        accessRevokedAt: null,
      },
    });
  }

  const existingLink = await prisma.academyChatLink.findFirst({
    where: {
      organizationId: access.organization.id,
      ...(sessionId ? { classSessionId: sessionId } : { academyClassId: resolvedClassId, classSessionId: null }),
    },
    select: { id: true },
  });

  const linked = existingLink
    ? await prisma.academyChatLink.update({
        where: { id: existingLink.id },
        data: {
          academyClassId: resolvedClassId,
          classSessionId: sessionId ?? null,
          conversationId,
          scope: sessionId ? "SESSION" : "CLASS",
          createdByUserId: access.profile.id,
        },
      })
    : await prisma.academyChatLink.create({
        data: {
          organizationId: access.organization.id,
          academyClassId: resolvedClassId,
          classSessionId: sessionId ?? null,
          conversationId,
          scope: sessionId ? "SESSION" : "CLASS",
          createdByUserId: access.profile.id,
        },
      });

  return respondOk(access.ctx, {
    thread: {
      id: linked.id,
      organizationId: linked.organizationId,
      classId: linked.academyClassId,
      sessionId: linked.classSessionId,
      threadRef: linked.conversationId,
      createdAt: linked.createdAt,
      updatedAt: linked.updatedAt,
    },
  });
}

export const POST = withApiEnvelope(_POST);
