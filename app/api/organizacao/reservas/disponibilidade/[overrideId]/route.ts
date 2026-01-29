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
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
    { status },
  );
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const overrideId = Number(resolved.overrideId);
  if (!Number.isFinite(overrideId)) {
    return fail(ctx, 400, "INVALID_OVERRIDE", "Override inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const override = await prisma.availabilityOverride.findFirst({
      where: { id: overrideId, organizationId: organization.id },
      select: { id: true, scopeType: true, scopeId: true },
    });

    if (!override) {
      return fail(ctx, 404, "OVERRIDE_NOT_FOUND", "Override não encontrado.");
    }

    if (membership.role === OrganizationMemberRole.STAFF) {
      if (override.scopeType === "ORGANIZATION" || override.scopeType === "RESOURCE") {
        return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
      }
      const professional = await prisma.reservationProfessional.findFirst({
        where: { id: override.scopeId, organizationId: organization.id, userId: profile.id },
        select: { id: true },
      });
      if (!professional) {
        return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
      }
    }

    await prisma.availabilityOverride.delete({ where: { id: override.id } });

    return respondOk(ctx, { deleted: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("DELETE /api/organizacao/reservas/disponibilidade/[overrideId] error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao remover override.");
  }
}

export const DELETE = withApiEnvelope(_DELETE);
