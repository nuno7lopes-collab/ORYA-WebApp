import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveReservasScopesForMember } from "@/lib/reservas/memberScopes";
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
    const includeCourts = (() => {
      const raw = req.nextUrl.searchParams.get("includeCourts");
      return raw === "1" || raw === "true";
    })();
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
    let allowedResourceIds: number[] | null = null;
    let allowedCourtIds: number[] | null = null;
    if (isStaff) {
      const scopes = await resolveReservasScopesForMember({
        organizationId: organization.id,
        userId: profile.id,
      });
      if (!scopes.hasAny) {
        return respondOk(ctx, { items: [] });
      }
      allowedResourceIds = scopes.resourceIds;
      allowedCourtIds = scopes.courtIds;
    }

    const staffScopeOr: Array<Record<string, unknown>> = [];
    if (isStaff) {
      if (allowedResourceIds && allowedResourceIds.length > 0) {
        staffScopeOr.push({ id: { in: allowedResourceIds } });
      }
      if (includeCourts && allowedCourtIds && allowedCourtIds.length > 0) {
        staffScopeOr.push({ courtId: { in: allowedCourtIds } });
      }
      if (staffScopeOr.length === 0) {
        return respondOk(ctx, { items: [] });
      }
    }

    const resources = await prisma.reservationResource.findMany({
      where: {
        organizationId: organization.id,
        ...(isStaff ? { OR: staffScopeOr } : {}),
      },
      orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
      select: {
        id: true,
        label: true,
        capacity: true,
        isActive: true,
        priority: true,
        courtId: true,
        court: {
          select: {
            id: true,
            name: true,
            isActive: true,
            displayOrder: true,
            deletedAt: true,
            padelClubId: true,
            club: { select: { name: true, deletedAt: true } },
          },
        },
      },
    });

    const resourceItems = resources
      .filter((resource) => resource.courtId == null)
      .map((resource) => ({
        id: resource.id,
        label: resource.label,
        capacity: resource.capacity,
        isActive: resource.isActive,
        priority: resource.priority,
        resourceId: resource.id,
        sourceType: "RESOURCE" as const,
        courtId: null,
        padelClubId: null,
        clubName: null,
      }));

    if (!includeCourts) {
      return respondOk(ctx, { items: resourceItems });
    }

    const linkedCourtItems = resources
      .filter((resource) => resource.courtId != null)
      .map((resource) => {
        const court = resource.court;
        if (!court || court.deletedAt || court.club.deletedAt) return null;
        return {
          id: court.id,
          label: court.name,
          capacity: resource.capacity,
          isActive: Boolean(resource.isActive && court.isActive),
          priority: court.displayOrder ?? resource.priority ?? 0,
          sourceType: "COURT" as const,
          resourceId: resource.id,
          courtId: court.id,
          padelClubId: court.padelClubId,
          clubName: court.club.name ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    // Transitional fallback while older environments may still have courts not yet linked.
    const linkedCourtIds = new Set(linkedCourtItems.map((item) => item.courtId));
    const missingCourts = await prisma.padelClubCourt.findMany({
      where: {
        club: {
          organizationId: organization.id,
          deletedAt: null,
        },
        deletedAt: null,
        isActive: true,
        id: { notIn: Array.from(linkedCourtIds) },
        reservationResource: { is: null },
        ...(isStaff
          ? allowedCourtIds && allowedCourtIds.length > 0
            ? { id: { in: allowedCourtIds } }
            : { id: { in: [] } }
          : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        displayOrder: true,
        padelClubId: true,
        club: { select: { name: true } },
      },
    });
    const missingCourtItems = missingCourts.map((court) => ({
      id: court.id,
      label: court.name,
      capacity: 4,
      isActive: court.isActive,
      priority: court.displayOrder ?? 0,
      sourceType: "COURT" as const,
      resourceId: null,
      courtId: court.id,
      padelClubId: court.padelClubId,
      clubName: court.club.name ?? null,
    }));

    return respondOk(ctx, { items: [...resourceItems, ...linkedCourtItems, ...missingCourtItems] });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/recursos error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar recursos.");
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
    const labelRaw = typeof payload?.label === "string" ? payload.label.trim() : "";
    const capacityRaw = Number(payload?.capacity);
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const priority = Number.isFinite(Number(payload?.priority)) ? Number(payload.priority) : 0;

    if (!labelRaw) {
      return fail(ctx, 400, "LABEL_REQUIRED", "Etiqueta obrigatória.");
    }
    if (!Number.isFinite(capacityRaw) || capacityRaw < 1) {
      return fail(ctx, 400, "INVALID_CAPACITY", "Capacidade inválida.");
    }

    const resource = await prisma.reservationResource.create({
      data: {
        organizationId: organization.id,
        label: labelRaw,
        capacity: Math.round(capacityRaw),
        isActive,
        priority,
      },
      select: { id: true, label: true, capacity: true, isActive: true, priority: true },
    });

    return respondOk(ctx, { resource }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/recursos error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao criar recurso.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
