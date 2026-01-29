import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const professionalId = parseId(resolved.id);
  if (!professionalId) {
    return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 400 });
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
      roles: [...VIEW_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json(reservasAccess, { status: 403 });
    }

    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: professionalId, organizationId: organization.id },
      select: { id: true, userId: true },
    });

    if (!professional) {
      return NextResponse.json({ ok: false, error: "Profissional não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const nameRaw = typeof payload?.name === "string" ? payload.name.trim() : "";
    const roleTitleRaw = typeof payload?.roleTitle === "string" ? payload.roleTitle.trim() : "";
    const isActiveRaw = typeof payload?.isActive === "boolean" ? payload.isActive : null;
    const priorityRaw = Number.isFinite(Number(payload?.priority)) ? Number(payload.priority) : null;

    const isStaff = membership.role === OrganizationMemberRole.STAFF;
    if (isStaff && professional.userId !== profile.id) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    if (!isStaff && !EDIT_ROLES.includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (nameRaw) data.name = nameRaw;
    if (roleTitleRaw || roleTitleRaw === "") data.roleTitle = roleTitleRaw || null;
    if (!isStaff && isActiveRaw !== null) data.isActive = isActiveRaw;
    if (!isStaff && priorityRaw !== null) data.priority = priorityRaw;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
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

    return NextResponse.json({ ok: true, professional: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/reservas/profissionais/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar profissional." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const professionalId = parseId(resolved.id);
  if (!professionalId) {
    return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 400 });
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
      roles: [...EDIT_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json(reservasAccess, { status: 403 });
    }

    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: professionalId, organizationId: organization.id },
      select: { id: true },
    });

    if (!professional) {
      return NextResponse.json({ ok: false, error: "Profissional não encontrado." }, { status: 404 });
    }

    await prisma.reservationProfessional.delete({ where: { id: professional.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/reservas/profissionais/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover profissional." }, { status: 500 });
  }
}
