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

export async function GET(req: NextRequest) {
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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const isStaff = membership.role === OrganizationMemberRole.STAFF;

    if (isStaff) {
      const existing = await prisma.reservationProfessional.findFirst({
        where: { organizationId: organization.id, userId: profile.id },
        select: { id: true },
      });
      if (!existing) {
        const fallbackName = profile.fullName?.trim() || profile.username?.trim() || "Staff";
        await prisma.reservationProfessional.create({
          data: {
            organizationId: organization.id,
            userId: profile.id,
            name: fallbackName,
            roleTitle: "Staff",
            isActive: true,
            priority: 0,
          },
        });
      }
    }

    const where = isStaff
      ? { organizationId: organization.id, userId: profile.id }
      : { organizationId: organization.id };

    const items = await prisma.reservationProfessional.findMany({
      where,
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        roleTitle: true,
        isActive: true,
        priority: true,
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/reservas/profissionais error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar profissionais." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const nameRaw = typeof payload?.name === "string" ? payload.name.trim() : "";
    const roleTitleRaw = typeof payload?.roleTitle === "string" ? payload.roleTitle.trim() : "";
    const userIdRaw = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const priority = Number.isFinite(Number(payload?.priority)) ? Number(payload.priority) : 0;

    let resolvedName = nameRaw;
    if (!resolvedName && userIdRaw) {
      const userProfile = await prisma.profile.findUnique({
        where: { id: userIdRaw },
        select: { fullName: true, username: true },
      });
      resolvedName = userProfile?.fullName?.trim() || userProfile?.username?.trim() || "";
    }

    if (!resolvedName) {
      return NextResponse.json({ ok: false, error: "Nome obrigatório." }, { status: 400 });
    }

    if (userIdRaw) {
      const member = await prisma.organizationMember.findFirst({
        where: { organizationId: organization.id, userId: userIdRaw },
        select: { id: true },
      });
      if (!member) {
        return NextResponse.json({ ok: false, error: "Utilizador não pertence à organização." }, { status: 400 });
      }

      const existing = await prisma.reservationProfessional.findFirst({
        where: { organizationId: organization.id, userId: userIdRaw },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ ok: false, error: "Profissional já existe para este utilizador." }, { status: 409 });
      }
    }

    const professional = await prisma.reservationProfessional.create({
      data: {
        organizationId: organization.id,
        userId: userIdRaw || null,
        name: resolvedName,
        roleTitle: roleTitleRaw || null,
        isActive,
        priority,
      },
      select: {
        id: true,
        name: true,
        roleTitle: true,
        isActive: true,
        priority: true,
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ ok: true, professional }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/profissionais error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar profissional." }, { status: 500 });
  }
}
