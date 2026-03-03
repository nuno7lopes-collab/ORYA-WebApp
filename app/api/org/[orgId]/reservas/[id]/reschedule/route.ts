import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import {
  groupByScope,
  type AvailabilityScopeType,
  type ScopedOverride,
  type ScopedSchedule,
  type ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { clampOrgRescheduleWindowMinutes } from "@/lib/policies/bookingPolicyGuardrails";
import {
  normalizeReservationAssignmentMode,
  resolveServiceAssignmentMode,
} from "@/lib/reservas/serviceAssignment";
import { buildHybridSlotMatrix, selectBestHybridPairForSlot } from "@/lib/reservas/hybridAssignment";
import { resolveServicePartySizeRules, validateRequestedPartySize } from "@/lib/reservas/servicePartySize";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { OrganizationMemberRole, OrganizationRolePack } from "@prisma/client";
import type { BookingStatus } from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { intersectIds, resolveReservasScopesForMember, resolveCoachProfessionalIds } from "@/lib/reservas/memberScopes";
import { computeBookingPriceComponents } from "@/lib/reservas/bookingPricing";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";
import {
  getOrganizationBookingPolicy,
  validateDurationAgainstPolicy,
  validateStartAtAgainstPolicy,
} from "@/lib/reservas/gridPolicy";
import { resolveAllowedServiceScopeIds } from "@/lib/reservas/serviceScopes";
import {
  agendaConflictResponse,
  buildBookingConflictBlocks,
  buildSessionConflictBlocks,
} from "@/lib/reservas/agendaConflictHelpers";
import { resolvePendingBookingState } from "@/lib/reservas/pendingBookingState";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
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

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function isPendingState(status: string | null | undefined) {
  return status === "PENDING_CONFIRMATION" || status === "PENDING";
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(ctx, 400, "INVALID_ID", "ID inválido.");
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
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt.trim() : "";
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail(ctx, 400, "INVALID_DATE", "Data inválida.");
    }
    const now = new Date();

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      include: {
        professional: { select: { userId: true } },
        resource: { select: { id: true, capacity: true, courtId: true } },
        addons: {
          select: {
            addonId: true,
            label: true,
            deltaMinutes: true,
            deltaPriceCents: true,
            quantity: true,
            sortOrder: true,
          },
        },
        bookingPackage: {
          select: {
            packageId: true,
            label: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
        service: {
          select: {
            id: true,
            organizationId: true,
            kind: true,
            assignmentMode: true,
            partySizeRequired: true,
            partySizeMin: true,
            partySizeMax: true,
            partySizeStep: true,
            durationMinutes: true,
            unitPriceCents: true,
            currency: true,
            professionalLinks: { select: { professionalId: true, professional: { select: { isActive: true } } } },
            resourceLinks: {
              select: { resourceId: true, resource: { select: { isActive: true, capacity: true, courtId: true } } },
            },
            organization: {
              select: { timezone: true, reservationAssignmentMode: true, orgRescheduleWindowMinutes: true },
            },
          },
        },
      },
    });

    if (!booking) {
      return fail(ctx, 404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
    }
    if (membership.role === OrganizationMemberRole.STAFF) {
      const isCoach = membership.rolePack === OrganizationRolePack.COACH;
      const scopes = await resolveReservasScopesForMember({
        organizationId: organization.id,
        userId: profile.id,
      });
      if (!scopes.hasAny) {
        return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
      }
      if (isCoach) {
        const coachProfessionalIds = await resolveCoachProfessionalIds({
          organizationId: organization.id,
          userId: profile.id,
        });
        const allowedProfessionals = scopes.professionalIds.length
          ? intersectIds(coachProfessionalIds, scopes.professionalIds)
          : coachProfessionalIds;
        if (!allowedProfessionals.length || !booking.professionalId || !allowedProfessionals.includes(booking.professionalId)) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        if (scopes.courtIds.length && booking.courtId && !scopes.courtIds.includes(booking.courtId)) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        if (scopes.resourceIds.length && booking.resourceId && !scopes.resourceIds.includes(booking.resourceId)) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
      } else {
        const allowed = [
          booking.courtId && scopes.courtIds.includes(booking.courtId),
          booking.resourceId && scopes.resourceIds.includes(booking.resourceId),
          booking.professionalId && scopes.professionalIds.includes(booking.professionalId),
        ].some(Boolean);
        if (!allowed) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
      }
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(booking.status)) {
      return fail(ctx, 409, "BOOKING_CLOSED", "Reserva já encerrada.");
    }
    const pendingState = resolvePendingBookingState({
      status: booking["status"],
      startsAt: booking.startsAt,
      pendingExpiresAt: booking.pendingExpiresAt,
      createdAt: booking.createdAt,
      now,
    });
    if ((pendingState === "EXPIRED" || pendingState === "PAST_START") && isPendingState(booking["status"])) {
      return fail(ctx, 409, "BOOKING_CLOSED", "Reserva pendente expirada.");
    }

    const timezone = booking.service.organization?.timezone || "Europe/Lisbon";
    const bookingPolicy = await getOrganizationBookingPolicy({
      organizationId: organization.id,
      tx: prisma,
    });
    const startValidation = validateStartAtAgainstPolicy({
      startsAt,
      timezone,
      policy: bookingPolicy,
    });
    if (!startValidation.ok) {
      return fail(ctx, 400, startValidation.errorCode, startValidation.message);
    }
    const durationValidation = validateDurationAgainstPolicy({
      durationMinutes: booking.durationMinutes,
      policy: bookingPolicy,
    });
    if (!durationValidation.ok) {
      return fail(ctx, 400, durationValidation.errorCode, durationValidation.message);
    }

    if (startsAt <= new Date()) {
      return fail(ctx, 400, "TIME_PASSED", "Este horário já passou.");
    }
    const orgRescheduleWindowMinutes = clampOrgRescheduleWindowMinutes(
      booking.service.organization?.orgRescheduleWindowMinutes ?? null,
    );
    const msUntilBooking = booking.startsAt.getTime() - now.getTime();
    if (msUntilBooking < orgRescheduleWindowMinutes * 60 * 1000) {
      return fail(ctx, 400, "RESCHEDULE_WINDOW_EXPIRED", "Prazo de reagendamento expirado.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: booking.service.organization?.reservationAssignmentMode ?? null,
      serviceMode: booking.service.assignmentMode ?? null,
      serviceKind: booking.service.kind ?? null,
    });
    const bookingAssignmentMode = normalizeReservationAssignmentMode(
      booking.assignmentMode ?? assignmentConfig.assignmentMode,
    );
    const availabilityMode =
      bookingAssignmentMode === "PROFESSIONAL_AND_RESOURCE"
        ? "HYBRID"
        : bookingAssignmentMode === "RESOURCE_ONLY"
          ? "RESOURCE"
          : "PROFESSIONAL";
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: bookingAssignmentMode,
      serviceKind: booking.service.kind ?? null,
      partySizeRequired: booking.service.partySizeRequired,
      partySizeMin: booking.service.partySizeMin,
      partySizeMax: booking.service.partySizeMax,
      partySizeStep: booking.service.partySizeStep,
    });
    const partySizeValidation = validateRequestedPartySize({
      requested: booking.partySize ?? null,
      rules: partySizeRules,
    });
    if (!partySizeValidation.ok) {
      return fail(ctx, 400, partySizeValidation.errorCode, partySizeValidation.message);
    }

    const { allowedProfessionalIds, allowedResourceIds } = resolveAllowedServiceScopeIds({
      professionalLinks: booking.service.professionalLinks,
      resourceLinks: booking.service.resourceLinks,
    });

    let professionalId: number | null = booking.professionalId ?? null;
    let resourceId: number | null = booking.resourceId ?? null;
    let nextCourtId: number | null = booking.courtId ?? null;
    const partySize: number | null = partySizeValidation.partySize;
    const scopeType: AvailabilityScopeType =
      availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];
    const resourceCourtById = new Map<number, number | null>();
    let professionalScopes: Array<{ id: number; priority: number }> = [];
    let resourceScopes: Array<{ id: number; capacity: number; priority: number; courtId: number | null }> = [];

    if (availabilityMode === "RESOURCE") {
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (!resource) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (assignmentConfig.isCourtService) {
          if (!resource.courtId) {
            return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Recurso sem ligação canónica a campo.");
          }
        }
        if (allowedResourceIds && !allowedResourceIds.includes(resource.id)) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (partySize != null && resource.capacity < partySize) {
          return fail(ctx, 400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        resourceCourtById.set(resource.id, resource.courtId ?? null);
        resourceScopes = [resource];
        nextCourtId = assignmentConfig.isCourtService ? resource.courtId ?? null : null;
        scopeIds = [resource.id];
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.service.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        resources.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
        resourceScopes = resources;
        scopeIds = resources.map((resource) => resource.id);
      }
    } else if (availabilityMode === "PROFESSIONAL") {
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalScopes = [professional];
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(ctx, 409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: booking.service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
        professionalScopes = professionals;
        scopeIds = professionals.map((professional) => professional.id);
      }
    } else {
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalScopes = [professional];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(ctx, 409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        professionalScopes = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: booking.service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
      }
      if (professionalScopes.length === 0) {
        return fail(ctx, 409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (!resource) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (
          assignmentConfig.isCourtService &&
          !resource.courtId
        ) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (allowedResourceIds && !allowedResourceIds.includes(resource.id)) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (partySize != null && resource.capacity < partySize) {
          return fail(ctx, 400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        resourceCourtById.set(resource.id, resource.courtId ?? null);
        resourceScopes = [resource];
      } else {
        resourceScopes = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.service.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        resourceScopes.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
      }
      if (resourceScopes.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      scopeIds = professionalScopes.map((professional) => professional.id);
    }

    if (availabilityMode !== "HYBRID" && scopeIds.length === 0) {
      return fail(ctx, 409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);
    const conflictWindowStart = getConflictWindowStart(dayStart);

    const bookingEndsAt = new Date(startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const professionalScopeIds =
      availabilityMode === "HYBRID"
        ? professionalScopes.map((item) => item.id)
        : availabilityMode === "PROFESSIONAL"
          ? scopeIds
          : [];
    const resourceScopeIds =
      availabilityMode === "HYBRID"
        ? resourceScopes.map((item) => item.id)
        : availabilityMode === "RESOURCE"
          ? scopeIds
          : [];
    const scopedConflictFilter =
      availabilityMode === "RESOURCE"
        ? { resourceId: { in: resourceScopeIds } }
        : availabilityMode === "PROFESSIONAL"
          ? { professionalId: { in: professionalScopeIds } }
          : {
              OR: [
                { professionalId: { in: professionalScopeIds } },
                { resourceId: { in: resourceScopeIds } },
              ],
            };
    const activeBookedStatuses: BookingStatus[] = ["CONFIRMED", "DISPUTED", "NO_SHOW"];
    const activePendingStatuses: BookingStatus[] = ["PENDING_CONFIRMATION", "PENDING"];
    const activeBookingStatusFilter = {
      OR: [
        { status: { in: activeBookedStatuses } },
        { status: { in: activePendingStatuses }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
      ],
    };
    const scopeFilters =
      availabilityMode === "HYBRID"
        ? [
            { scopeType: "ORGANIZATION" as const, scopeId: 0 },
            { scopeType: "PROFESSIONAL" as const, scopeId: { in: professionalScopeIds } },
            { scopeType: "RESOURCE" as const, scopeId: { in: resourceScopeIds } },
          ]
        : [
            { scopeType: "ORGANIZATION" as const, scopeId: 0 },
            { scopeType, scopeId: { in: scopeIds } },
          ];
    const [schedules, overrides, blockingBookings, classSessions] = await Promise.all([
      prisma.availabilitySchedule.findMany({
        where: {
          organizationId: booking.service.organizationId,
          OR: scopeFilters,
        },
        select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: booking.service.organizationId,
          OR: scopeFilters,
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: booking.service.organizationId,
          id: { not: booking.id },
          startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
          AND: [scopedConflictFilter, activeBookingStatusFilter],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      availabilityMode === "RESOURCE"
        ? Promise.resolve([])
        : prisma.classSession.findMany({
            where: {
              organizationId: booking.service.organizationId,
              status: "SCHEDULED",
              startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
              endsAt: { gt: conflictWindowStart },
              ...(professionalScopeIds.length > 0 ? { professionalId: { in: professionalScopeIds } } : {}),
            },
            select: { id: true, startsAt: true, endsAt: true, professionalId: true },
          }),
    ]);

    const scheduleIds = schedules.map((schedule) => schedule.id);
    const templates = scheduleIds.length
      ? await prisma.weeklyAvailabilityTemplate.findMany({
          where: { availabilityId: { in: scheduleIds } },
          select: { availabilityId: true, dayOfWeek: true, intervals: true },
        })
      : [];
    const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const schedulesByScope = groupByScope(schedules);
    const overridesByScope = groupByScope(overrides);
    const blocks = [
      ...buildBookingConflictBlocks(blockingBookings),
      ...buildSessionConflictBlocks(classSessions),
    ];

    const slotKey = startsAt.toISOString();
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;
    let conflictDecision: ReturnType<typeof evaluateCandidate> | null = null;

    if (availabilityMode === "HYBRID") {
      const matrix = buildHybridSlotMatrix({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: booking.durationMinutes,
        stepMinutes: bookingPolicy.gridMinutes,
        now,
        professionals: professionalScopes,
        resources: resourceScopes,
        orgSchedules: orgSchedules as ScopedSchedule[],
        templates: templates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        schedulesByScope,
        overridesByScope,
        blocks,
      });
      const pair = selectBestHybridPairForSlot({
        slotKey,
        professionals: professionalScopes,
        resources: resourceScopes,
        professionalSlotKeysById: matrix.professionalSlotKeysById,
        resourceSlotKeysById: matrix.resourceSlotKeysById,
      });
      if (!pair) {
        return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
      }
      professionalId = pair.professionalId;
      resourceId = pair.resourceId;
      nextCourtId = assignmentConfig.isCourtService ? pair.courtId ?? null : null;
      slotIsAvailable = true;

      const candidate: AgendaCandidate = {
        type: "BOOKING",
        sourceId: String(booking.id),
        startsAt,
        endsAt: bookingEndsAt,
      };
      const existingProfessional: AgendaCandidate[] = blockingBookings
        .filter((item) => item.professionalId === professionalId)
        .map((item) => ({
          type: "BOOKING",
          sourceId: String(item.id),
          startsAt: item.startsAt,
          endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
        }));
      classSessions.forEach((session) => {
        if (!session.professionalId || session.professionalId !== professionalId) return;
        existingProfessional.push({
          type: "BOOKING",
          sourceId: `class:${session.id}`,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
        });
      });
      const existingResource: AgendaCandidate[] = blockingBookings
        .filter((item) => item.resourceId === resourceId)
        .map((item) => ({
          type: "BOOKING",
          sourceId: String(item.id),
          startsAt: item.startsAt,
          endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
        }));
      const proDecision = evaluateCandidate({ candidate, existing: existingProfessional });
      const resourceDecision = evaluateCandidate({ candidate, existing: existingResource });
      if (!proDecision.allowed) {
        conflictDecision = proDecision;
      } else if (!resourceDecision.allowed) {
        conflictDecision = resourceDecision;
      }
    } else {
      const localScopeType: AvailabilityScopeType =
        availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
      const localScopeIds =
        availabilityMode === "RESOURCE" ? resourceScopeIds : professionalScopeIds;
      const scopesToCheck = localScopeIds.map((id) => ({ scopeType: localScopeType, scopeId: id }));

      for (const scope of scopesToCheck) {
        const slots = getAvailableSlotsForScope({
          rangeStart: dayStart,
          rangeEnd: dayEnd,
          timezone,
          durationMinutes: booking.durationMinutes,
          stepMinutes: bookingPolicy.gridMinutes,
          now,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          orgSchedules: orgSchedules as ScopedSchedule[],
          templates: templates as ScopedTemplate[],
          orgOverrides: orgOverrides as ScopedOverride[],
          schedulesByScope,
          overridesByScope,
          blocks,
        });
        if (slots.some((slot) => slot.startsAt.toISOString() === slotKey)) {
          slotIsAvailable = true;
          assignedScopeId = scope.scopeId;
          break;
        }
      }
      if (availabilityMode === "RESOURCE" && assignedScopeId) {
        resourceId = assignedScopeId;
      }
      if (availabilityMode === "PROFESSIONAL" && assignedScopeId) {
        professionalId = assignedScopeId;
      }
      if (availabilityMode === "RESOURCE" && resourceId) {
        let linkedCourtId = resourceCourtById.get(resourceId) ?? null;
        if (linkedCourtId == null) {
          const resource = await prisma.reservationResource.findUnique({
            where: { id: resourceId },
            select: { courtId: true },
          });
          linkedCourtId = resource?.courtId ?? null;
        }
        nextCourtId = assignmentConfig.isCourtService ? linkedCourtId : null;
        if (assignmentConfig.isCourtService && !nextCourtId) {
          return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Sem ligação canónica entre campo e recurso.");
        }
      }

      const scopeIdForConflict = availabilityMode === "RESOURCE" ? resourceId : professionalId;
      if (!scopeIdForConflict) {
        const conflict = agendaConflictResponse();
        return fail(ctx, 503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
      }
      const candidate: AgendaCandidate = {
        type: "BOOKING",
        sourceId: String(booking.id),
        startsAt,
        endsAt: bookingEndsAt,
      };
      const existing: AgendaCandidate[] = blockingBookings
        .filter((item) =>
          availabilityMode === "RESOURCE" ? item.resourceId === scopeIdForConflict : item.professionalId === scopeIdForConflict,
        )
        .map((item) => ({
          type: "BOOKING",
          sourceId: String(item.id),
          startsAt: item.startsAt,
          endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
        }));
      classSessions.forEach((session) => {
        if (availabilityMode === "RESOURCE") return;
        if (!session.professionalId || session.professionalId !== scopeIdForConflict) return;
        existing.push({
          type: "BOOKING",
          sourceId: `class:${session.id}`,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
        });
      });
      conflictDecision = evaluateCandidate({ candidate, existing });
    }

    if (!slotIsAvailable) {
      return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }
    if (conflictDecision && !conflictDecision.allowed) {
      const conflict = agendaConflictResponse(conflictDecision);
      return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }
    if (availabilityMode === "HYBRID" && (!professionalId || !resourceId)) {
      return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem par disponível.");
    }
    if (availabilityMode === "HYBRID" && assignmentConfig.isCourtService && !nextCourtId) {
      return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Sem ligação canónica entre campo e recurso.");
    }

    const { ip, userAgent } = getRequestMeta(req);
    const expiresAt = new Date(Math.min(now.getTime() + 24 * 60 * 60 * 1000, startsAt.getTime() - 2 * 60 * 60 * 1000));
    if (expiresAt.getTime() <= now.getTime()) {
      return fail(ctx, 400, "RESCHEDULE_WINDOW_EXPIRED", "Prazo de reagendamento expirado.");
    }
    const pricing = computeBookingPriceComponents({
      serviceDurationMinutes: booking.service?.durationMinutes ?? booking.durationMinutes ?? 0,
      serviceUnitPriceCents: booking.service?.unitPriceCents ?? booking.price ?? 0,
      bookingPackage: booking.bookingPackage ?? null,
      addons: booking.addons ?? null,
    });
    const currentPriceCents = Math.max(0, Math.round(booking.price ?? pricing.priceCents ?? 0));
    const nextPriceCents = Math.max(0, Math.round(pricing.priceCents ?? currentPriceCents));
    const priceDeltaCents = nextPriceCents - currentPriceCents;
    const currency = (booking.currency ?? booking.service?.currency ?? "EUR").toUpperCase();

    const request = await prisma.$transaction(async (tx) => {
      const lockKey = `booking_change_request:${booking.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      await tx.bookingChangeRequest.updateMany({
        where: { bookingId: booking.id, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: now, respondedByUserId: profile.id },
      });

      return tx.bookingChangeRequest.create({
        data: {
          bookingId: booking.id,
          organizationId: booking.organizationId,
          requestedBy: "ORG",
          requestedByUserId: profile.id,
          status: "PENDING",
          proposedStartsAt: startsAt,
          proposedCourtId:
            availabilityMode === "RESOURCE" || availabilityMode === "HYBRID"
              ? nextCourtId
              : booking.courtId ?? null,
          proposedProfessionalId: professionalId ?? null,
          proposedResourceId: resourceId ?? null,
          priceDeltaCents,
          currency,
          expiresAt,
        },
      });
    });

    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "BOOKING_RESCHEDULE_REQUESTED",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        previousStartsAt: booking.startsAt.toISOString(),
        nextStartsAt: startsAt.toISOString(),
        actorRole: membership.role,
        requestId: request.id,
        expiresAt: request.expiresAt.toISOString(),
        priceDeltaCents,
      },
      ip,
      userAgent,
    });

    if (booking.userId) {
      const shouldSend = await shouldNotify(booking.userId, "BOOKING_CHANGE_REQUEST");
      if (shouldSend) {
        await createNotification({
          userId: booking.userId,
          type: "BOOKING_CHANGE_REQUEST",
          title: "Pedido de reagendamento",
          body: `Nova data proposta: ${startsAt.toLocaleString("pt-PT", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          ctaUrl: "/me/reservas",
          ctaLabel: "Responder",
          organizationId: organization.id,
          payload: {
            bookingId: booking.id,
            requestId: request.id,
            expiresAt: request.expiresAt.toISOString(),
          },
        });
      }
    }

    return respondOk(ctx, { request });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/reschedule error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao reagendar reserva.");
  }
}

export const POST = withApiEnvelope(_POST);
