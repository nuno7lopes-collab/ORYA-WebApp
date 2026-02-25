import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { applyAvailabilityChangeset, mapChangesetError } from "@/lib/reservas/availabilityChangesets";
import { ensureChangesetScopeAccess } from "@/lib/reservas/availabilityChangesetAccess";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

async function _POST(req: NextRequest, { params }: { params: Promise<{ changeSetId: string }> }) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const changeSetId = parseId(resolved.changeSetId);
  if (!changeSetId) {
    return fail(ctx, 400, "INVALID_ID", "ID inválido.");
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

    const scopeAccess = await ensureChangesetScopeAccess({
      organizationId: organization.id,
      changeSetId,
      role: membership.role,
      userId: profile.id,
    });
    if (!scopeAccess.ok) {
      return fail(ctx, scopeAccess.status, scopeAccess.errorCode, scopeAccess.message);
    }

    const result = await prisma.$transaction(async (tx) =>
      applyAvailabilityChangeset({
        tx,
        changeSetId,
        organizationId: organization.id,
      }),
    );

    return respondOk(ctx, {
      changeSetId,
      status: "APPLIED",
      ...result,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }

    const mapped = mapChangesetError(error);
    return fail(ctx, mapped.status, mapped.errorCode, mapped.message, mapped.details);
  }
}

export const POST = withApiEnvelope(_POST);
