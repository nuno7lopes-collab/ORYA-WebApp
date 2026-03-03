import type { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

export const ACADEMY_ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

export function academyFail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    {
      errorCode,
      message,
      retryable: status >= 500,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export async function resolveAcademyOrgAccess(
  req: NextRequest,
  options?: { roles?: OrganizationMemberRole[] },
) {
  const ctx = getRequestContext(req);

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

    if (!profile) {
      return {
        ok: false as const,
        response: academyFail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado."),
        ctx,
      };
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: options?.roles ?? [...ACADEMY_ROLE_ALLOWLIST],
      includeOrganizationFields: "settings",
    });

    if (!organization || !membership) {
      return {
        ok: false as const,
        response: academyFail(ctx, 403, "FORBIDDEN", "Sem permissões."),
        ctx,
      };
    }

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return {
        ok: false as const,
        response: academyFail(
          ctx,
          403,
          "RESERVAS_UNAVAILABLE",
          reservasAccess.error ?? "Reservas indisponíveis.",
        ),
        ctx,
      };
    }

    return {
      ok: true as const,
      ctx,
      profile,
      organization,
      membership,
    };
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return {
        ok: false as const,
        response: academyFail(ctx, 401, "UNAUTHENTICATED", "Não autenticado."),
        ctx,
      };
    }
    console.error("[academy][access]", err);
    return {
      ok: false as const,
      response: academyFail(ctx, 500, "INTERNAL_ERROR", "Erro interno de autenticação."),
      ctx,
    };
  }
}
