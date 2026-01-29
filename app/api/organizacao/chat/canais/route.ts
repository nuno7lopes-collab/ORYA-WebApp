import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
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

const DEFAULT_CHANNELS = [
  { name: "Geral", description: "Conversas rápidas da equipa." },
  { name: "Operações", description: "Coordenação do dia-a-dia." },
  { name: "Financeiro", description: "Notas internas e alertas." },
];

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(req: NextRequest) {
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
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "ORG_CHAT_CHANNELS" });
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

    const params = req.nextUrl.searchParams;
    const includeArchived = params.get("includeArchived") === "true";
    const limit = parseLimit(params.get("limit"));

    await prisma.$transaction(async (tx) => {
      const count = await tx.internalChatChannel.count({
        where: { organizationId: organization.id },
      });
      if (count === 0) {
        await tx.internalChatChannel.createMany({
          data: DEFAULT_CHANNELS.map((channel) => ({
            organizationId: organization.id,
            name: channel.name,
            description: channel.description,
          })),
          skipDuplicates: true,
        });
      }
    });

    const channels = await prisma.internalChatChannel.findMany({
      where: {
        organizationId: organization.id,
        ...(includeArchived ? {} : { isArchived: false }),
      } as Prisma.InternalChatChannelWhereInput,
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return respondOk(ctx, { items: channels });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("GET /api/organizacao/chat/canais error:", err);
    return fail(500, "Erro ao carregar canais.");
  }
}

export async function POST(req: NextRequest) {
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

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : null;

    if (name.length < 2) {
      return fail(400, "Nome do canal inválido.");
    }

    let channel;
    try {
      channel = await prisma.internalChatChannel.create({
        data: {
          organizationId: organization.id,
          name,
          description: description || undefined,
          createdByUserId: user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return fail(409, "Canal já existe.");
      }
      throw err;
    }

    return respondOk(ctx, { channel });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/chat/canais error:", err);
    return fail(500, "Erro ao criar canal.");
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
