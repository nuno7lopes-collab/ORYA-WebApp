import type { BookingStatus, Prisma } from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import {
  agendaConflictResponse,
  buildBookingConflictBlocks,
  buildSessionConflictBlocks,
} from "@/lib/reservas/agendaConflictHelpers";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";
import {
  getOrganizationBookingPolicy,
  validateDurationAgainstPolicy,
  validateStartAtAgainstPolicy,
} from "@/lib/reservas/gridPolicy";
import { buildHybridSlotMatrix, selectBestHybridPairForSlot } from "@/lib/reservas/hybridAssignment";
import {
  groupByScope,
  type AvailabilityScopeType,
  type ScopedOverride,
  type ScopedSchedule,
  type ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";
import {
  normalizeReservationAssignmentMode,
  resolveServiceAssignmentMode,
} from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules, validateRequestedPartySize } from "@/lib/reservas/servicePartySize";
import { resolveAllowedServiceScopeIds } from "@/lib/reservas/serviceScopes";
import {
  buildEventClaimCandidatesForProfessional,
  buildEventClaimCandidatesForResource,
  buildEventClaimConflictBlocks,
  loadActiveEventClaimBlocks,
} from "@/lib/reservas/eventClaims";

const ACTIVE_BOOKED_STATUSES: BookingStatus[] = ["CONFIRMED", "DISPUTED", "NO_SHOW"];
const ACTIVE_PENDING_STATUSES: BookingStatus[] = ["PENDING_CONFIRMATION", "PENDING"];

export type BookingChangeApplyValidationCode =
  | "NOT_FOUND"
  | "REQUEST_NOT_PENDING"
  | "REQUEST_EXPIRED"
  | "BOOKING_CLOSED"
  | "TIME_PASSED"
  | "INVALID_START_GRID"
  | "INVALID_DURATION_POLICY"
  | "PROFESSIONAL_INVALID"
  | "RESOURCE_INVALID"
  | "RESOURCE_CAPACITY_EXCEEDED"
  | "COURT_RESOURCE_INVALID"
  | "SERVICE_CONFIG_INVALID"
  | "SLOT_UNAVAILABLE"
  | "AGENDA_CONFLICT";

export type BookingChangeApplyValidationFailure = {
  ok: false;
  code: BookingChangeApplyValidationCode;
  message: string;
  details?: Record<string, unknown>;
  bookingId: number | null;
  organizationId: number | null;
  requestId: number | null;
};

export type BookingChangeApplyValidationSuccess = {
  ok: true;
  bookingId: number;
  organizationId: number;
  requestId: number;
  startsAt: Date;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
  priceDeltaCents: number;
};

export type BookingChangeApplyValidationResult =
  | BookingChangeApplyValidationSuccess
  | BookingChangeApplyValidationFailure;

function fail(params: {
  code: BookingChangeApplyValidationCode;
  message: string;
  details?: Record<string, unknown>;
  bookingId?: number | null;
  organizationId?: number | null;
  requestId?: number | null;
}): BookingChangeApplyValidationFailure {
  return {
    ok: false,
    code: params.code,
    message: params.message,
    details: params.details,
    bookingId: params.bookingId ?? null,
    organizationId: params.organizationId ?? null,
    requestId: params.requestId ?? null,
  };
}

export async function validateBookingChangeApply(params: {
  tx: Prisma.TransactionClient;
  bookingId: number;
  requestId: number;
  now?: Date;
}): Promise<BookingChangeApplyValidationResult> {
  const { tx, bookingId, requestId, now = new Date() } = params;

  const lockScope = await tx.bookingChangeRequest.findUnique({
    where: { id: requestId },
    select: { id: true, bookingId: true, organizationId: true },
  });
  if (!lockScope || lockScope.bookingId !== bookingId) {
    return fail({ code: "NOT_FOUND", message: "Pedido de alteração não encontrado." });
  }

  const lockKey = `booking:${lockScope.organizationId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const request = await tx.bookingChangeRequest.findFirst({
    where: { id: requestId, bookingId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      proposedStartsAt: true,
      proposedCourtId: true,
      proposedProfessionalId: true,
      proposedResourceId: true,
      priceDeltaCents: true,
      booking: {
        select: {
          id: true,
          organizationId: true,
          serviceId: true,
          status: true,
          startsAt: true,
          durationMinutes: true,
          assignmentMode: true,
          professionalId: true,
          resourceId: true,
          courtId: true,
          partySize: true,
          snapshotTimezone: true,
          service: {
            select: {
              id: true,
              kind: true,
              assignmentMode: true,
              partySizeRequired: true,
              partySizeMin: true,
              partySizeMax: true,
              partySizeStep: true,
              organizationId: true,
              professionalLinks: {
                select: { professionalId: true, professional: { select: { isActive: true } } },
              },
              resourceLinks: {
                select: {
                  resourceId: true,
                  resource: { select: { isActive: true, capacity: true, courtId: true } },
                },
              },
              organization: {
                select: { timezone: true, reservationAssignmentMode: true },
              },
            },
          },
        },
      },
    },
  });

  if (!request || !request.booking || !request.booking.service) {
    return fail({
      code: "NOT_FOUND",
      message: "Pedido de alteração não encontrado.",
      bookingId,
      organizationId: lockScope.organizationId,
      requestId,
    });
  }

  const booking = request.booking;

  const context = {
    bookingId: booking.id,
    organizationId: booking.organizationId,
    requestId: request.id,
  };

  if (request.status !== "PENDING") {
    return fail({ code: "REQUEST_NOT_PENDING", message: "Pedido já processado.", ...context });
  }

  if (request.expiresAt.getTime() <= now.getTime()) {
    return fail({ code: "REQUEST_EXPIRED", message: "Pedido de alteração expirado.", ...context });
  }

  if (booking.status !== "CONFIRMED") {
    return fail({ code: "BOOKING_CLOSED", message: "Reserva já não está confirmada.", ...context });
  }

  const startsAt = request.proposedStartsAt;
  if (startsAt.getTime() <= now.getTime()) {
    return fail({ code: "TIME_PASSED", message: "Este horário já passou.", ...context });
  }

  const timezone =
    booking.service.organization?.timezone || booking.snapshotTimezone || "Europe/Lisbon";

  const bookingPolicy = await getOrganizationBookingPolicy({
    organizationId: booking.organizationId,
    tx,
  });

  const startValidation = validateStartAtAgainstPolicy({
    startsAt,
    timezone,
    policy: bookingPolicy,
  });
  if (!startValidation.ok) {
    return fail({
      code: startValidation.errorCode,
      message: startValidation.message,
      ...context,
    });
  }

  const durationValidation = validateDurationAgainstPolicy({
    durationMinutes: booking.durationMinutes,
    policy: bookingPolicy,
  });
  if (!durationValidation.ok) {
    return fail({
      code: durationValidation.errorCode,
      message: durationValidation.message,
      ...context,
    });
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
    return fail({
      code: "SERVICE_CONFIG_INVALID",
      message: partySizeValidation.message,
      ...context,
    });
  }

  const partySize = partySizeValidation.partySize;
  const { allowedProfessionalIds, allowedResourceIds } = resolveAllowedServiceScopeIds({
    professionalLinks: booking.service.professionalLinks,
    resourceLinks: booking.service.resourceLinks,
  });

  let professionalId: number | null = request.proposedProfessionalId ?? booking.professionalId ?? null;
  let resourceId: number | null = request.proposedResourceId ?? booking.resourceId ?? null;
  let courtId: number | null = request.proposedCourtId ?? booking.courtId ?? null;

  let selectedProfessional: { id: number; priority: number } | null = null;
  let selectedResource: { id: number; capacity: number; priority: number; courtId: number | null } | null = null;

  if (availabilityMode !== "RESOURCE") {
    if (!professionalId) {
      return fail({
        code: "SERVICE_CONFIG_INVALID",
        message: "Serviço sem profissional atribuído para o reagendamento.",
        ...context,
      });
    }
    if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
      return fail({ code: "PROFESSIONAL_INVALID", message: "Profissional inválido.", ...context });
    }
    const professional = await tx.reservationProfessional.findFirst({
      where: {
        id: professionalId,
        organizationId: booking.organizationId,
        isActive: true,
      },
      select: { id: true, priority: true },
    });
    if (!professional) {
      return fail({ code: "PROFESSIONAL_INVALID", message: "Profissional inválido.", ...context });
    }
    selectedProfessional = professional;
    professionalId = professional.id;
  }

  if (availabilityMode !== "PROFESSIONAL") {
    if (!resourceId) {
      return fail({
        code: "SERVICE_CONFIG_INVALID",
        message: "Serviço sem recurso atribuído para o reagendamento.",
        ...context,
      });
    }
    if (allowedResourceIds && !allowedResourceIds.includes(resourceId)) {
      return fail({ code: "RESOURCE_INVALID", message: "Recurso inválido.", ...context });
    }
    const resource = await tx.reservationResource.findFirst({
      where: {
        id: resourceId,
        organizationId: booking.organizationId,
        isActive: true,
      },
      select: { id: true, capacity: true, priority: true, courtId: true },
    });
    if (!resource) {
      return fail({ code: "RESOURCE_INVALID", message: "Recurso inválido.", ...context });
    }
    if (partySize != null && resource.capacity < partySize) {
      return fail({
        code: "RESOURCE_CAPACITY_EXCEEDED",
        message: "Capacidade acima do recurso.",
        ...context,
      });
    }
    if (assignmentConfig.isCourtService) {
      if (!resource.courtId) {
        return fail({
          code: "COURT_RESOURCE_INVALID",
          message: "Sem ligação canónica entre campo e recurso.",
          ...context,
        });
      }
      if (request.proposedCourtId && request.proposedCourtId !== resource.courtId) {
        return fail({
          code: "COURT_RESOURCE_INVALID",
          message: "Recurso/campo propostos estão incoerentes.",
          ...context,
        });
      }
      courtId = resource.courtId;
    } else {
      courtId = null;
    }
    selectedResource = resource;
    resourceId = resource.id;
  }

  if (availabilityMode === "HYBRID" && (!professionalId || !resourceId || !selectedProfessional || !selectedResource)) {
    return fail({
      code: "SERVICE_CONFIG_INVALID",
      message: "Serviço híbrido sem par válido para aplicar reagendamento.",
      ...context,
    });
  }

  const dateParts = getDateParts(startsAt, timezone);
  const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
  const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);
  const conflictWindowStart = getConflictWindowStart(dayStart);
  const bookingEndsAt = new Date(startsAt.getTime() + booking.durationMinutes * 60 * 1000);

  const professionalScopeIds =
    availabilityMode === "HYBRID"
      ? professionalId != null
        ? [professionalId]
        : []
      : availabilityMode === "PROFESSIONAL"
        ? professionalId != null
          ? [professionalId]
          : []
        : [];

  const resourceScopeIds =
    availabilityMode === "HYBRID"
      ? resourceId != null
        ? [resourceId]
        : []
      : availabilityMode === "RESOURCE"
        ? resourceId != null
          ? [resourceId]
          : []
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

  const activeBookingStatusFilter = {
    OR: [
      { status: { in: ACTIVE_BOOKED_STATUSES } },
      { status: { in: ACTIVE_PENDING_STATUSES }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
    ],
  };

  const scopeType: AvailabilityScopeType = availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
  const scopeIds = availabilityMode === "RESOURCE" ? resourceScopeIds : professionalScopeIds;

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
  const courtToResourceIds = new Map<number, number[]>();
  if (selectedResource?.id && selectedResource.courtId) {
    courtToResourceIds.set(selectedResource.courtId, [selectedResource.id]);
  }

  const [schedules, overrides, blockingBookings, classSessions, eventClaimBlocks] = await Promise.all([
    tx.availabilitySchedule.findMany({
      where: {
        organizationId: booking.organizationId,
        OR: scopeFilters,
      },
      select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
    }),
    tx.availabilityOverride.findMany({
      where: {
        organizationId: booking.organizationId,
        OR: scopeFilters,
        date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
    }),
    tx.booking.findMany({
      where: {
        organizationId: booking.organizationId,
        id: { not: booking.id },
        startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
        AND: [scopedConflictFilter, activeBookingStatusFilter],
      },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        professionalId: true,
        resourceId: true,
      },
    }),
    availabilityMode === "RESOURCE"
      ? Promise.resolve([])
      : tx.classSession.findMany({
          where: {
            organizationId: booking.organizationId,
            status: "SCHEDULED",
            startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
            endsAt: { gt: conflictWindowStart },
            ...(professionalScopeIds.length > 0
              ? { professionalId: { in: professionalScopeIds } }
              : {}),
          },
          select: { id: true, startsAt: true, endsAt: true, professionalId: true },
        }),
    loadActiveEventClaimBlocks({
      tx: tx as any,
      organizationId: booking.organizationId,
      rangeStart: conflictWindowStart,
      rangeEnd: bookingEndsAt,
      professionalIds: professionalId != null ? [professionalId] : [],
      resourceIds: resourceId != null ? [resourceId] : [],
      courtIds: courtId != null ? [courtId] : [],
    }),
  ]);

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const templates = scheduleIds.length
    ? await tx.weeklyAvailabilityTemplate.findMany({
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
    ...buildEventClaimConflictBlocks({ claims: eventClaimBlocks, courtToResourceIds }),
  ];

  const slotKey = startsAt.toISOString();

  if (availabilityMode === "HYBRID") {
    const matrix = buildHybridSlotMatrix({
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      timezone,
      durationMinutes: booking.durationMinutes,
      stepMinutes: bookingPolicy.gridMinutes,
      now,
      professionals: [selectedProfessional!],
      resources: [selectedResource!],
      orgSchedules: orgSchedules as ScopedSchedule[],
      templates: templates as ScopedTemplate[],
      orgOverrides: orgOverrides as ScopedOverride[],
      schedulesByScope,
      overridesByScope,
      blocks,
    });

    const pair = selectBestHybridPairForSlot({
      slotKey,
      professionals: [selectedProfessional!],
      resources: [selectedResource!],
      professionalSlotKeysById: matrix.professionalSlotKeysById,
      resourceSlotKeysById: matrix.resourceSlotKeysById,
    });

    if (!pair || pair.professionalId !== professionalId || pair.resourceId !== resourceId) {
      return fail({ code: "SLOT_UNAVAILABLE", message: "Horário indisponível.", ...context });
    }

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
    existingProfessional.push(
      ...buildEventClaimCandidatesForProfessional({
        claims: eventClaimBlocks,
        professionalId,
      }),
    );

    const existingResource: AgendaCandidate[] = blockingBookings
      .filter((item) => item.resourceId === resourceId)
      .map((item) => ({
        type: "BOOKING",
        sourceId: String(item.id),
        startsAt: item.startsAt,
        endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
      }));
    existingResource.push(
      ...buildEventClaimCandidatesForResource({
        claims: eventClaimBlocks,
        resourceId,
        courtId,
      }),
    );

    const proDecision = evaluateCandidate({ candidate, existing: existingProfessional });
    if (!proDecision.allowed) {
      const conflict = agendaConflictResponse(proDecision);
      return fail({
        code: "AGENDA_CONFLICT",
        message: "Conflito de agenda.",
        details: conflict.details,
        ...context,
      });
    }

    const resourceDecision = evaluateCandidate({ candidate, existing: existingResource });
    if (!resourceDecision.allowed) {
      const conflict = agendaConflictResponse(resourceDecision);
      return fail({
        code: "AGENDA_CONFLICT",
        message: "Conflito de agenda.",
        details: conflict.details,
        ...context,
      });
    }
  } else {
    const selectedScopeId = availabilityMode === "RESOURCE" ? resourceId : professionalId;
    const selectedScopeType: AvailabilityScopeType =
      availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";

    if (!selectedScopeId) {
      return fail({
        code: "SERVICE_CONFIG_INVALID",
        message: "Configuração de serviço inválida para reagendamento.",
        ...context,
      });
    }

    const slots = getAvailableSlotsForScope({
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      timezone,
      durationMinutes: booking.durationMinutes,
      stepMinutes: bookingPolicy.gridMinutes,
      now,
      scopeType: selectedScopeType,
      scopeId: selectedScopeId,
      orgSchedules: orgSchedules as ScopedSchedule[],
      templates: templates as ScopedTemplate[],
      orgOverrides: orgOverrides as ScopedOverride[],
      schedulesByScope,
      overridesByScope,
      blocks,
    });

    if (!slots.some((slot) => slot.startsAt.toISOString() === slotKey)) {
      return fail({ code: "SLOT_UNAVAILABLE", message: "Horário indisponível.", ...context });
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: String(booking.id),
      startsAt,
      endsAt: bookingEndsAt,
    };

    const existing: AgendaCandidate[] = blockingBookings
      .filter((item) =>
        availabilityMode === "RESOURCE"
          ? item.resourceId === selectedScopeId
          : item.professionalId === selectedScopeId,
      )
      .map((item) => ({
        type: "BOOKING",
        sourceId: String(item.id),
        startsAt: item.startsAt,
        endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
      }));

    classSessions.forEach((session) => {
      if (availabilityMode === "RESOURCE") return;
      if (!session.professionalId || session.professionalId !== selectedScopeId) return;
      existing.push({
        type: "BOOKING",
        sourceId: `class:${session.id}`,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    });
    if (availabilityMode === "RESOURCE") {
      existing.push(
        ...buildEventClaimCandidatesForResource({
          claims: eventClaimBlocks,
          resourceId: selectedScopeId,
          courtId,
        }),
      );
    } else {
      existing.push(
        ...buildEventClaimCandidatesForProfessional({
          claims: eventClaimBlocks,
          professionalId: selectedScopeId,
        }),
      );
    }

    const conflictDecision = evaluateCandidate({ candidate, existing });
    if (!conflictDecision.allowed) {
      const conflict = agendaConflictResponse(conflictDecision);
      return fail({
        code: "AGENDA_CONFLICT",
        message: "Conflito de agenda.",
        details: conflict.details,
        ...context,
      });
    }
  }

  return {
    ok: true,
    bookingId: booking.id,
    organizationId: booking.organizationId,
    requestId: request.id,
    startsAt,
    professionalId,
    resourceId,
    courtId,
    priceDeltaCents: request.priceDeltaCents,
  };
}
