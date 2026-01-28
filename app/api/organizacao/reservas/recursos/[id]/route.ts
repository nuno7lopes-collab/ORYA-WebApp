import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";
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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const resourceId = parseId(resolved.id);
  if (!resourceId) {
    return jsonWrap({ ok: false, error: "Recurso inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...EDIT_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const resource = await prisma.reservationResource.findFirst({
      where: { id: resourceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!resource) {
      return jsonWrap({ ok: false, error: "Recurso não encontrado." }, { status: 404 });
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
      return jsonWrap({ ok: false, error: "Nada para atualizar." }, { status: 400 });
    }

    const updated = await prisma.reservationResource.update({
      where: { id: resource.id },
      data,
      select: { id: true, label: true, capacity: true, isActive: true, priority: true },
    });

    return jsonWrap({ ok: true, resource: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/reservas/recursos/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar recurso." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const resourceId = parseId(resolved.id);
  if (!resourceId) {
    return jsonWrap({ ok: false, error: "Recurso inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...EDIT_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const resource = await prisma.reservationResource.findFirst({
      where: { id: resourceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!resource) {
      return jsonWrap({ ok: false, error: "Recurso não encontrado." }, { status: 404 });
    }

    await prisma.reservationResource.delete({ where: { id: resource.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/reservas/recursos/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover recurso." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);