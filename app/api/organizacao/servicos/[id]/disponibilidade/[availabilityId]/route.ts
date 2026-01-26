import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";

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

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; availabilityId: string }> },
) {
  const resolved = await params;
  const serviceId = parseId(resolved.id);
  const overrideId = parseId(resolved.availabilityId);
  if (!serviceId || !overrideId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });
    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const override = await prisma.availabilityOverride.findFirst({
      where: { id: overrideId, organizationId: organization.id },
      select: { id: true, date: true, kind: true, scopeType: true, scopeId: true },
    });
    if (!override) {
      return NextResponse.json({ ok: false, error: "Override não encontrado." }, { status: 404 });
    }

    if (membership.role === OrganizationMemberRole.STAFF) {
      if (override.scopeType === "ORGANIZATION" || override.scopeType === "RESOURCE") {
        return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
      }
      const professional = await prisma.reservationProfessional.findFirst({
        where: { id: override.scopeId, organizationId: organization.id, userId: profile.id },
        select: { id: true },
      });
      if (!professional) {
        return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
      }
    }

    await prisma.availabilityOverride.delete({ where: { id: override.id } });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "AVAILABILITY_OVERRIDE_DELETED",
      metadata: { overrideId: override.id, date: override.date.toISOString(), kind: override.kind },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/servicos/[id]/disponibilidade/[availabilityId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover override." }, { status: 500 });
  }
}
