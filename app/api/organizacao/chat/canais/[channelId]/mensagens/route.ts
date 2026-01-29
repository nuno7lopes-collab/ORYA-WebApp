import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(req: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "ORG_CHAT_MESSAGES" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return fail(403, "Chat interno desativado.");
    }

    const { channelId } = await context.params;
    const channel = await prisma.internalChatChannel.findFirst({
      where: { id: channelId, organizationId: organization.id },
      select: { id: true, name: true },
    });
    if (!channel) {
      return fail(404, "Canal não encontrado.");
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const messages = await prisma.internalChatMessage.findMany({
      where: { organizationId: organization.id, channelId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return respondOk(ctx, {
      channel,
      items: messages.slice().reverse(),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("GET /api/organizacao/chat/canais/[channelId]/mensagens error:", err);
    return fail(500, "Erro ao carregar mensagens.");
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return fail(403, "Chat interno desativado.");
    }

    const { channelId } = await context.params;
    const channel = await prisma.internalChatChannel.findFirst({
      where: { id: channelId, organizationId: organization.id, isArchived: false },
      select: { id: true, organizationId: true },
    });
    if (!channel) {
      return fail(404, "Canal não encontrado.");
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (body.length < 1) {
      return fail(400, "Mensagem inválida.");
    }

    const message = await prisma.internalChatMessage.create({
      data: {
        body,
        organization: { connect: { id: channel.organizationId } },
        channel: { connect: { id: channelId } },
        author: { connect: { id: user.id } },
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return respondOk(ctx, { message });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/chat/canais/[channelId]/mensagens error:", err);
    return fail(500, "Erro ao enviar mensagem.");
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
