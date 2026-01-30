import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const VIEW_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...VIEW_ROLES],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      const message =
        "message" in reservasAccess && typeof reservasAccess.message === "string"
          ? reservasAccess.message
          : reservasAccess.error ?? "Sem permissões.";
      return respondError(
        ctx,
        {
          errorCode: reservasAccess.error ?? "FORBIDDEN",
          message,
          retryable: false,
          details: reservasAccess,
        },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);

    const items = await prisma.serviceReview.findMany({
      where: { organizationId: organization.id, isVerified: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { fullName: true, avatarUrl: true } },
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/avaliacoes error:", err);
    return fail(500, "Erro ao carregar avaliações.");
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
