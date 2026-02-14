import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
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

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
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

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/profissionais error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar profissionais.");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
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
      return fail(ctx, 400, "NAME_REQUIRED", "Nome obrigatório.");
    }

    if (userIdRaw) {
      const member = await resolveGroupMemberForOrg({
        organizationId: organization.id,
        userId: userIdRaw,
      });
      if (!member) {
        return fail(ctx, 400, "USER_NOT_IN_ORG", "Utilizador não pertence à organização.");
      }

      const existing = await prisma.reservationProfessional.findFirst({
        where: { organizationId: organization.id, userId: userIdRaw },
        select: { id: true },
      });
      if (existing) {
        return fail(ctx, 409, "PROFESSIONAL_EXISTS", "Profissional já existe para este utilizador.");
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

    return respondOk(ctx, { professional }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/profissionais error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao criar profissional.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
