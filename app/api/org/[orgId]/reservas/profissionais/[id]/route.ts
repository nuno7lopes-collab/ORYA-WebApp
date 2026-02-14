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

const VIEW_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const EDIT_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const professionalId = parseId(resolved.id);
  if (!professionalId) {
    return fail(ctx, 400, "INVALID_PROFESSIONAL", "Profissional inválido.");
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
      roles: [...VIEW_ROLES],
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

    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: professionalId, organizationId: organization.id },
      select: { id: true, userId: true },
    });

    if (!professional) {
      return fail(ctx, 404, "PROFESSIONAL_NOT_FOUND", "Profissional não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const nameRaw = typeof payload?.name === "string" ? payload.name.trim() : "";
    const roleTitleRaw = typeof payload?.roleTitle === "string" ? payload.roleTitle.trim() : "";
    const isActiveRaw = typeof payload?.isActive === "boolean" ? payload.isActive : null;
    const priorityRaw = Number.isFinite(Number(payload?.priority)) ? Number(payload.priority) : null;

    const isStaff = membership.role === OrganizationMemberRole.STAFF;
    if (isStaff && professional.userId !== profile.id) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    if (!isStaff && !EDIT_ROLES.includes(membership.role)) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const data: Record<string, unknown> = {};
    if (nameRaw) data.name = nameRaw;
    if (roleTitleRaw || roleTitleRaw === "") data.roleTitle = roleTitleRaw || null;
    if (!isStaff && isActiveRaw !== null) data.isActive = isActiveRaw;
    if (!isStaff && priorityRaw !== null) data.priority = priorityRaw;

    if (Object.keys(data).length === 0) {
      return fail(ctx, 400, "NOTHING_TO_UPDATE", "Nada para atualizar.");
    }

    const updated = await prisma.reservationProfessional.update({
      where: { id: professional.id },
      data,
      select: {
        id: true,
        name: true,
        roleTitle: true,
        isActive: true,
        priority: true,
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    return respondOk(ctx, { professional: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/reservas/profissionais/[id] error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao atualizar profissional.");
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const professionalId = parseId(resolved.id);
  if (!professionalId) {
    return fail(ctx, 400, "INVALID_PROFESSIONAL", "Profissional inválido.");
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
      roles: [...EDIT_ROLES],
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

    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: professionalId, organizationId: organization.id },
      select: { id: true },
    });

    if (!professional) {
      return fail(ctx, 404, "PROFESSIONAL_NOT_FOUND", "Profissional não encontrado.");
    }

    await prisma.reservationProfessional.delete({ where: { id: professional.id } });

    return respondOk(ctx, { deleted: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("DELETE /api/org/[orgId]/reservas/profissionais/[id] error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao remover profissional.");
  }
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
