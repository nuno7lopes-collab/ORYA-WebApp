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
  const resourceId = parseId(resolved.id);
  if (!resourceId) {
    return fail(ctx, 400, "INVALID_RESOURCE", "Recurso inválido.");
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

    const resource = await prisma.reservationResource.findFirst({
      where: { id: resourceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!resource) {
      return fail(ctx, 404, "RESOURCE_NOT_FOUND", "Recurso não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const labelRaw = typeof payload?.label === "string" ? payload.label.trim() : "";
    const capacityRaw = Number.isFinite(Number(payload?.capacity)) ? Number(payload.capacity) : null;
    const isActiveRaw = typeof payload?.isActive === "boolean" ? payload.isActive : null;
    const priorityRaw = Number.isFinite(Number(payload?.priority)) ? Number(payload.priority) : null;

    const data: Record<string, unknown> = {};
    if (labelRaw) data.label = labelRaw;
    if (capacityRaw !== null && capacityRaw >= 1) data.capacity = Math.round(capacityRaw);
    if (isActiveRaw !== null) data.isActive = isActiveRaw;
    if (priorityRaw !== null) data.priority = priorityRaw;

    if (Object.keys(data).length === 0) {
      return fail(ctx, 400, "NOTHING_TO_UPDATE", "Nada para atualizar.");
    }

    const updated = await prisma.reservationResource.update({
      where: { id: resource.id },
      data,
      select: { id: true, label: true, capacity: true, isActive: true, priority: true },
    });

    return respondOk(ctx, { resource: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("PATCH /api/organizacao/reservas/recursos/[id] error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao atualizar recurso.");
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const resourceId = parseId(resolved.id);
  if (!resourceId) {
    return fail(ctx, 400, "INVALID_RESOURCE", "Recurso inválido.");
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

    const resource = await prisma.reservationResource.findFirst({
      where: { id: resourceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!resource) {
      return fail(ctx, 404, "RESOURCE_NOT_FOUND", "Recurso não encontrado.");
    }

    await prisma.reservationResource.delete({ where: { id: resource.id } });

    return respondOk(ctx, { deleted: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("DELETE /api/organizacao/reservas/recursos/[id] error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao remover recurso.");
  }
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
