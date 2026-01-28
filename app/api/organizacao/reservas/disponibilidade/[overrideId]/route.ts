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

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> },
) {
  const resolved = await params;
  const overrideId = Number(resolved.overrideId);
  if (!Number.isFinite(overrideId)) {
    return jsonWrap({ ok: false, error: "Override inválido." }, { status: 400 });
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
      roles: [...ROLE_ALLOWLIST],
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

    const override = await prisma.availabilityOverride.findFirst({
      where: { id: overrideId, organizationId: organization.id },
      select: { id: true, scopeType: true, scopeId: true },
    });

    if (!override) {
      return jsonWrap({ ok: false, error: "Override não encontrado." }, { status: 404 });
    }

    if (membership.role === OrganizationMemberRole.STAFF) {
      if (override.scopeType === "ORGANIZATION" || override.scopeType === "RESOURCE") {
        return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
      }
      const professional = await prisma.reservationProfessional.findFirst({
        where: { id: override.scopeId, organizationId: organization.id, userId: profile.id },
        select: { id: true },
      });
      if (!professional) {
        return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
      }
    }

    await prisma.availabilityOverride.delete({ where: { id: override.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/reservas/disponibilidade/[overrideId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover override." }, { status: 500 });
  }
}
export const DELETE = withApiEnvelope(_DELETE);