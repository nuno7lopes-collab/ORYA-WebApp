import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { resolveScheduleForDate } from "@/lib/reservas/availability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const VALID_SCOPE_TYPES = ["ORGANIZATION", "PROFESSIONAL", "RESOURCE"] as const;
type ScopeType = (typeof VALID_SCOPE_TYPES)[number];

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

function resolveScopeErrorCode(error: string) {
  if (error === "Scope inválido.") return "SCOPE_INVALID";
  if (error === "Profissional inválido.") return "PROFESSIONAL_INVALID";
  if (error === "Recurso inválido.") return "RESOURCE_INVALID";
  return "FORBIDDEN";
}

function parseScopeType(raw: unknown): ScopeType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return VALID_SCOPE_TYPES.includes(value as ScopeType) ? (value as ScopeType) : null;
}

function parseScopeId(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: 0 };
  }

  if (!scopeId) {
    return { ok: false as const, error: "Scope inválido." };
  }

  if (scopeType === "PROFESSIONAL") {
    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId: params.organizationId },
      select: { id: true, userId: true },
    });
    if (!professional) return { ok: false as const, error: "Profissional inválido." };
    if (params.role === OrganizationMemberRole.STAFF && professional.userId !== params.userId) {
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: professional.id };
  }

  if (params.role === OrganizationMemberRole.STAFF) {
    return { ok: false as const, error: "Sem permissões." };
  }

  const resource = await prisma.reservationResource.findFirst({
    where: { id: scopeId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!resource) return { ok: false as const, error: "Recurso inválido." };

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

    const scopeResolution = await resolveScope({
      scopeTypeRaw: req.nextUrl.searchParams.get("scopeType"),
      scopeIdRaw: req.nextUrl.searchParams.get("scopeId"),
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return fail(ctx, 403, resolveScopeErrorCode(scopeResolution.error), scopeResolution.error);
    }

    const { scopeType, scopeId } = scopeResolution;
    const timezone = organization.timezone || "Europe/Lisbon";
    const scheduleIdParam = parseScopeId(req.nextUrl.searchParams.get("scheduleId"));
    const includeTemplatesAll = req.nextUrl.searchParams.get("includeTemplates") === "all";

    const schedules = await prisma.availabilitySchedule.findMany({
      where: { organizationId: organization.id, scopeType, scopeId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, startDate: true, endDate: true, createdAt: true, updatedAt: true },
    });
    const activeSchedule = resolveScheduleForDate(schedules, new Date(), timezone);
    const selectedSchedule = scheduleIdParam
      ? schedules.find((schedule) => schedule.id === scheduleIdParam) ?? null
      : activeSchedule;

    const scheduleIds = schedules.map((schedule) => schedule.id);
    const [templates, overrides] = await Promise.all([
      includeTemplatesAll
        ? scheduleIds.length
          ? prisma.weeklyAvailabilityTemplate.findMany({
              where: { availabilityId: { in: scheduleIds } },
              orderBy: [{ availabilityId: "asc" }, { dayOfWeek: "asc" }],
              select: { id: true, dayOfWeek: true, intervals: true, availabilityId: true },
            })
          : Promise.resolve([])
        : selectedSchedule
          ? prisma.weeklyAvailabilityTemplate.findMany({
              where: { availabilityId: selectedSchedule.id },
              orderBy: { dayOfWeek: "asc" },
              select: { id: true, dayOfWeek: true, intervals: true, availabilityId: true },
            })
          : Promise.resolve([]),
      prisma.availabilityOverride.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, date: true, kind: true, intervals: true },
      }),
    ]);

    return respondOk(ctx, {
      scope: { scopeType, scopeId },
      timezone,
      schedules,
      activeScheduleId: activeSchedule?.id ?? null,
      selectedScheduleId: selectedSchedule?.id ?? null,
      templates,
      overrides,
      inheritsOrganization: scopeType !== "ORGANIZATION" && !activeSchedule,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/disponibilidade error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar disponibilidade.");
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
    const scopeResolution = await resolveScope({
      scopeTypeRaw: payload?.scopeType,
      scopeIdRaw: payload?.scopeId,
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return fail(ctx, 403, resolveScopeErrorCode(scopeResolution.error), scopeResolution.error);
    }

    const mode = typeof payload?.mode === "string" ? payload.mode.trim().toUpperCase() : "";
    if (["SCHEDULE", "SCHEDULE_DELETE", "TEMPLATE", "OVERRIDE"].includes(mode)) {
      return fail(
        ctx,
        409,
        "AVAILABILITY_CHANGESET_REQUIRED",
        "As alterações de disponibilidade são aplicadas via changeset para garantir resolução de conflitos.",
      );
    }

    return fail(ctx, 400, "INVALID_REQUEST", "Pedido inválido.");
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/disponibilidade error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao guardar disponibilidade.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
