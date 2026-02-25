import { NextRequest } from "next/server";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  applyAvailabilityChangeset,
  createAvailabilityChangeset,
  mapChangesetError,
  type AvailabilityDraftInput,
} from "@/lib/reservas/availabilityChangesets";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const VALID_SCOPE_TYPES = ["ORGANIZATION", "PROFESSIONAL", "RESOURCE"] as const;
const VALID_STATUS = ["PENDING", "READY_TO_APPLY", "APPLIED", "CANCELLED"] as const;

type ScopeType = (typeof VALID_SCOPE_TYPES)[number];
type ChangeSetStatus = (typeof VALID_STATUS)[number];

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

function parseScopeType(raw: unknown): ScopeType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return VALID_SCOPE_TYPES.includes(value as ScopeType) ? (value as ScopeType) : null;
}

function parseScopeId(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStatusFilters(raw: string | null): ChangeSetStatus[] {
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is ChangeSetStatus => VALID_STATUS.includes(item as ChangeSetStatus));
  return [...new Set(values)];
}

function parseCursor(raw: string | null) {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : 20;
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

async function resolveScope(params: {
  scopeTypeRaw: unknown;
  scopeIdRaw: unknown;
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole;
}) {
  const scopeType = parseScopeType(params.scopeTypeRaw) ?? "ORGANIZATION";
  const scopeId = parseScopeId(params.scopeIdRaw);

  if (scopeType === "ORGANIZATION") {
    if (params.role === OrganizationMemberRole.STAFF) {
      return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: 0 };
  }

  if (!scopeId) {
    return { ok: false as const, status: 400, errorCode: "SCOPE_INVALID", message: "Scope inválido." };
  }

  if (scopeType === "PROFESSIONAL") {
    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId: params.organizationId },
      select: { id: true, userId: true },
    });
    if (!professional) {
      return { ok: false as const, status: 404, errorCode: "PROFESSIONAL_INVALID", message: "Profissional inválido." };
    }
    if (params.role === OrganizationMemberRole.STAFF && professional.userId !== params.userId) {
      return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: professional.id };
  }

  if (params.role === OrganizationMemberRole.STAFF) {
    return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  const resource = await prisma.reservationResource.findFirst({
    where: { id: scopeId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!resource) {
    return { ok: false as const, status: 404, errorCode: "RESOURCE_INVALID", message: "Recurso inválido." };
  }
  return { ok: true as const, scopeType, scopeId: resource.id };
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
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const scopeTypeRaw = req.nextUrl.searchParams.get("scopeType");
    const scopeIdRaw = req.nextUrl.searchParams.get("scopeId");
    const hasScopeFilter = Boolean(scopeTypeRaw || scopeIdRaw);

    let scopeFilter: { scopeType: ScopeType; scopeId: number } | null = null;
    if (hasScopeFilter) {
      const resolvedScope = await resolveScope({
        scopeTypeRaw,
        scopeIdRaw,
        organizationId: organization.id,
        userId: profile.id,
        role: membership.role,
      });
      if (!resolvedScope.ok) {
        return fail(ctx, resolvedScope.status, resolvedScope.errorCode, resolvedScope.message);
      }
      scopeFilter = { scopeType: resolvedScope.scopeType, scopeId: resolvedScope.scopeId };
    }

    let staffProfessionalIds: number[] = [];
    if (membership.role === OrganizationMemberRole.STAFF) {
      const professionals = await prisma.reservationProfessional.findMany({
        where: { organizationId: organization.id, userId: profile.id },
        select: { id: true },
      });
      staffProfessionalIds = professionals.map((item) => item.id);
      if (!staffProfessionalIds.length) {
        return respondOk(ctx, {
          items: [],
          summary: {
            pendingSets: 0,
            readyToApplySets: 0,
            openConflictsTotal: 0,
          },
          pagination: {
            limit: parseLimit(req.nextUrl.searchParams.get("limit")),
            nextCursor: null,
          },
        });
      }
    }

    const statusRaw =
      req.nextUrl.searchParams.get("statuses") ??
      req.nextUrl.searchParams.get("status") ??
      req.nextUrl.searchParams.get("state");
    const statusFilter = parseStatusFilters(statusRaw);
    const cursor = parseCursor(req.nextUrl.searchParams.get("cursor"));
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

    const whereBase: Prisma.AvailabilityChangeSetWhereInput = {
      organizationId: organization.id,
      ...(scopeFilter ? { scopeType: scopeFilter.scopeType, scopeId: scopeFilter.scopeId } : {}),
      ...(statusFilter.length ? { status: { in: statusFilter } } : {}),
    };

    if (membership.role === OrganizationMemberRole.STAFF) {
      if (scopeFilter) {
        if (scopeFilter.scopeType !== "PROFESSIONAL" || !staffProfessionalIds.includes(scopeFilter.scopeId)) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
      } else {
        whereBase.scopeType = "PROFESSIONAL";
        whereBase.scopeId = { in: staffProfessionalIds };
      }
    }

    const itemsRaw = await prisma.availabilityChangeSet.findMany({
      where: {
        ...whereBase,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        appliedAt: true,
        cancelledAt: true,
        _count: {
          select: {
            conflicts: {
              where: { status: "OPEN" },
            },
          },
        },
      },
    });

    const hasMore = itemsRaw.length > limit;
    const items = (hasMore ? itemsRaw.slice(0, limit) : itemsRaw).map((item) => ({
      id: item.id,
      scopeType: item.scopeType,
      scopeId: item.scopeId,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      appliedAt: item.appliedAt,
      cancelledAt: item.cancelledAt,
      conflictsOpen: item._count.conflicts,
    }));

    const summaryBase: Prisma.AvailabilityChangeSetWhereInput = {
      organizationId: organization.id,
      ...(scopeFilter ? { scopeType: scopeFilter.scopeType, scopeId: scopeFilter.scopeId } : {}),
    };
    if (membership.role === OrganizationMemberRole.STAFF) {
      if (!scopeFilter) {
        summaryBase.scopeType = "PROFESSIONAL";
        summaryBase.scopeId = { in: staffProfessionalIds };
      }
    }

    const [pendingSets, readyToApplySets, openConflictsTotal] = await Promise.all([
      prisma.availabilityChangeSet.count({
        where: {
          ...summaryBase,
          status: "PENDING",
        },
      }),
      prisma.availabilityChangeSet.count({
        where: {
          ...summaryBase,
          status: "READY_TO_APPLY",
        },
      }),
      prisma.availabilityChangeConflict.count({
        where: {
          organizationId: organization.id,
          status: "OPEN",
          changeSet: summaryBase,
        },
      }),
    ]);

    return respondOk(ctx, {
      items,
      summary: {
        pendingSets,
        readyToApplySets,
        openConflictsTotal,
      },
      pagination: {
        limit,
        nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      },
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }

    const mapped = mapChangesetError(error);
    return fail(ctx, mapped.status, mapped.errorCode, mapped.message, mapped.details);
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

    const payload = await req.json().catch(() => ({}));

    const scope = await resolveScope({
      scopeTypeRaw: payload?.scopeType,
      scopeIdRaw: payload?.scopeId,
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scope.ok) {
      return fail(ctx, scope.status, scope.errorCode, scope.message);
    }

    const scheduleId = parseScopeId(payload?.scheduleId);
    const providedStartDate = typeof payload?.startDate === "string" ? payload.startDate.trim() : "";

    let startDate = providedStartDate;
    if (!startDate && scheduleId) {
      const existingSchedule = await prisma.availabilitySchedule.findFirst({
        where: {
          id: scheduleId,
          organizationId: organization.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
        },
        select: { startDate: true },
      });
      if (existingSchedule) {
        startDate = existingSchedule.startDate.toISOString().slice(0, 10);
      }
    }

    const draftInput: AvailabilityDraftInput = {
      scheduleId: payload?.scheduleId,
      startDate,
      endDate: payload?.endDate ?? null,
      templates: payload?.templates ?? {},
      overrides: Array.isArray(payload?.overrides) ? payload.overrides : [],
    };

    const autoApply = payload?.autoApply !== false;

    const result = await prisma.$transaction(async (tx) => {
      const created = await createAvailabilityChangeset({
        tx,
        scope: {
          organizationId: organization.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          timezone: organization.timezone || "Europe/Lisbon",
        },
        draftInput,
        requestedByUserId: profile.id,
      });

      if (created.conflictsOpen === 0 && autoApply) {
        const applied = await applyAvailabilityChangeset({
          tx,
          organizationId: organization.id,
          changeSetId: created.changeSetId,
        });
        return {
          ...created,
          status: "APPLIED",
          applied: true,
          scheduleId: applied.scheduleId ?? null,
        };
      }

      return {
        ...created,
        applied: false,
        scheduleId: null,
      };
    });

    if (result.conflictsOpen > 0) {
      return fail(
        ctx,
        409,
        "AVAILABILITY_CONFLICTS_FOUND",
        "Foram encontrados conflitos de disponibilidade. Resolve-os antes de aplicar.",
        {
          changeSetId: result.changeSetId,
          status: result.status,
          conflictsOpen: result.conflictsOpen,
        },
      );
    }

    return respondOk(ctx, {
      changeSetId: result.changeSetId,
      status: result.status,
      conflictsOpen: result.conflictsOpen,
      applied: result.applied,
      scheduleId: result.scheduleId,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }

    const mapped = mapChangesetError(error);
    return fail(ctx, mapped.status, mapped.errorCode, mapped.message, mapped.details);
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
