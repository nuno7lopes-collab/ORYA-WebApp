import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import {
  groupByScope,
  type AvailabilityScopeType,
  type ScopedOverride,
  type ScopedSchedule,
  type ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";
import { normalizeReservationAssignmentMode, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { buildHybridSlotMatrix, selectBestHybridPairForSlot } from "@/lib/reservas/hybridAssignment";
import { resolveServicePartySizeRules, validateRequestedPartySize } from "@/lib/reservas/servicePartySize";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { updateBooking } from "@/domain/bookings/commands";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import type { Prisma } from "@prisma/client";
import {
  getSnapshotAllowReschedule,
  getSnapshotRescheduleWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { normalizeEmail } from "@/lib/utils/email";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";

const SLOT_STEP_MINUTES = 5;

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function getMinutesOfDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function buildBlocks(
  bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>,
) {
  return bookings.map((booking) => ({
    start: booking.startsAt,
    end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
  }));
}

function buildSessionBlocks(sessions: Array<{ startsAt: Date; endsAt: Date; professionalId: number | null }>) {
  return sessions.map((session) => ({
    start: session.startsAt,
    end: session.endsAt,
    professionalId: session.professionalId,
    resourceId: null,
  }));
}

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" });
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  const fail = (status: number, errorCode: string, message: string, details?: Record<string, unknown>) =>
    respondError(
      ctx,
      { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
      { status },
    );

  if (!bookingId) {
    return fail(400, "INVALID_ID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = await req.json().catch(() => ({}));
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt.trim() : "";
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail(400, "INVALID_DATE", "Data inválida.");
    }

    const now = new Date();
    if (startsAt.getTime() <= now.getTime()) {
      return fail(400, "DATE_IN_PAST", "Este horário já passou.");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        guestEmail: true,
        serviceId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        assignmentMode: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
        partySize: true,
        snapshotTimezone: true,
        confirmationSnapshot: true,
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
            professionalLinks: { select: { professionalId: true, professional: { select: { isActive: true } } } },
            resourceLinks: { select: { resourceId: true, resource: { select: { isActive: true, courtId: true } } } },
            organization: { select: { timezone: true, reservationAssignmentMode: true } },
          },
        },
      },
    });

    if (!booking) {
      return fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
    }

    const normalizedEmail = normalizeEmail(user.email ?? "");
    const isOwner =
      booking.userId === user.id ||
      (!booking.userId && booking.guestEmail && normalizedEmail && booking.guestEmail === normalizedEmail);
    if (!isOwner) {
      return fail(403, "FORBIDDEN", "Sem permissões.");
    }

    const { status } = booking;
    if (status !== "CONFIRMED") {
      return fail(409, "BOOKING_NOT_CONFIRMED", "Apenas reservas confirmadas podem ser reagendadas.");
    }

    const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
    if (!snapshot) {
      return fail(
        409,
        "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
        "Reserva confirmada sem snapshot. Corre o backfill antes de reagendar.",
        { bookingId: booking.id },
      );
    }

    const allowReschedule = getSnapshotAllowReschedule(snapshot);
    const rescheduleWindowMinutes = getSnapshotRescheduleWindowMinutes(snapshot);
    const decision = decideCancellation(booking.startsAt, rescheduleWindowMinutes, now);
    if (!allowReschedule || !decision.allowed) {
      return fail(
        400,
        "BOOKING_RESCHEDULE_WINDOW_EXPIRED",
        "O prazo de reagendamento já passou.",
        { deadline: decision.deadline?.toISOString() ?? null },
      );
    }

    const timezone = booking.service?.organization?.timezone || booking.snapshotTimezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return fail(400, "INVALID_TIME_GRID", "Horário fora da grelha de 5 minutos.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: booking.service?.organization?.reservationAssignmentMode ?? null,
      serviceMode: booking.service?.assignmentMode ?? null,
      serviceKind: booking.service?.kind ?? null,
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
      serviceKind: booking.service?.kind ?? null,
      partySizeRequired: booking.service?.partySizeRequired,
      partySizeMin: booking.service?.partySizeMin,
      partySizeMax: booking.service?.partySizeMax,
      partySizeStep: booking.service?.partySizeStep,
    });
    const partySizeValidation = validateRequestedPartySize({
      requested: booking.partySize ?? null,
      rules: partySizeRules,
    });
    if (!partySizeValidation.ok) {
      return fail(400, partySizeValidation.errorCode, partySizeValidation.message);
    }

    const allowedProfessionalIds = booking.service?.professionalLinks?.length
      ? booking.service.professionalLinks
          .filter((link) => link.professional?.isActive)
          .map((link) => link.professionalId)
      : null;
    const allowedResourceIds = booking.service?.resourceLinks?.length
      ? booking.service.resourceLinks
          .filter((link) => link.resource?.isActive)
          .map((link) => link.resourceId)
      : null;
    const allowedCourtIdsFromService = booking.service?.resourceLinks?.length
      ? booking.service.resourceLinks
          .filter((link) => link.resource?.isActive && (link.resource?.courtId ?? null) != null)
          .map((link) => link.resource?.courtId)
          .filter((value): value is number => typeof value === "number" && value > 0)
      : null;

    let professionalId: number | null = booking.professionalId ?? null;
    let resourceId: number | null = booking.resourceId ?? null;
    let nextCourtId: number | null = booking.courtId ?? null;
    const partySize: number | null = partySizeValidation.partySize;
    const scopeType: AvailabilityScopeType =
      availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];
    const resourceCourtById = new Map<number, number | null>();
    const enforceServiceResourceLinks = !assignmentConfig.isCourtService;
    let professionalScopes: Array<{ id: number; priority: number }> = [];
    let resourceScopes: Array<{ id: number; capacity: number; priority: number; courtId: number | null }> = [];

    if (availabilityMode === "RESOURCE") {
      if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.organizationId, isActive: true },
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (!resource) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (assignmentConfig.isCourtService) {
          if (!resource.courtId) {
            return fail(409, "COURT_RESOURCE_INVALID", "Recurso sem ligação canónica a campo.");
          }
          if (
            allowedCourtIdsFromService &&
            allowedCourtIdsFromService.length > 0 &&
            !allowedCourtIdsFromService.includes(resource.courtId) &&
            !(allowedResourceIds?.includes(resource.id) ?? false)
          ) {
            return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
          }
        } else if (enforceServiceResourceLinks && allowedResourceIds && !allowedResourceIds.includes(resource.id)) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (partySize != null && resource.capacity < partySize) {
          return fail(400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        resourceCourtById.set(resource.id, resource.courtId ?? null);
        resourceScopes = [resource];
        nextCourtId = assignmentConfig.isCourtService ? resource.courtId ?? null : null;
        scopeIds = [resource.id];
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(enforceServiceResourceLinks && allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
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
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalScopes = [professional];
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: booking.organizationId,
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
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalScopes = [professional];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        professionalScopes = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: booking.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
      }
      if (professionalScopes.length === 0) {
        return fail(409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
      }
      if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.organizationId, isActive: true },
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (!resource) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (
          assignmentConfig.isCourtService &&
          (!resource.courtId ||
            (allowedCourtIdsFromService &&
              allowedCourtIdsFromService.length > 0 &&
              !allowedCourtIdsFromService.includes(resource.courtId) &&
              !(allowedResourceIds?.includes(resource.id) ?? false)))
        ) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (enforceServiceResourceLinks && allowedResourceIds && !allowedResourceIds.includes(resource.id)) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (partySize != null && resource.capacity < partySize) {
          return fail(400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        resourceCourtById.set(resource.id, resource.courtId ?? null);
        resourceScopes = [resource];
      } else {
        resourceScopes = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(enforceServiceResourceLinks && allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        resourceScopes.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
      }
      if (resourceScopes.length === 0) {
        return fail(409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      scopeIds = professionalScopes.map((professional) => professional.id);
    }

    if (availabilityMode !== "HYBRID" && scopeIds.length === 0) {
      return fail(409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
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
    const activeBookedStates = ["CONFIRMED", "DISPUTED", "NO_SHOW"] as const;
    const activePendingStates = ["PENDING_CONFIRMATION", "PENDING"] as const;
    const activeBookingStateFilter: Prisma.BookingWhereInput = {
      OR: [
        { status: { in: [...activeBookedStates] as any } },
        { status: { in: [...activePendingStates] as any }, pendingExpiresAt: { gt: now } },
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
          organizationId: booking.organizationId,
          OR: scopeFilters,
        },
        select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: booking.organizationId,
          OR: scopeFilters,
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: booking.organizationId,
          id: { not: booking.id },
          startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
          AND: [scopedConflictFilter, activeBookingStateFilter],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      availabilityMode === "RESOURCE"
        ? Promise.resolve([])
        : prisma.classSession.findMany({
            where: {
              organizationId: booking.organizationId,
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
    const blocks = [...buildBlocks(blockingBookings), ...buildSessionBlocks(classSessions)];

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
        stepMinutes: SLOT_STEP_MINUTES,
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
        return fail(409, "SLOT_UNAVAILABLE", "Horário indisponível.");
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
      const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = localScopeIds.map((id) => ({
        scopeType: localScopeType,
        scopeId: id,
      }));

      for (const scope of scopesToCheck) {
        const slots = getAvailableSlotsForScope({
          rangeStart: dayStart,
          rangeEnd: dayEnd,
          timezone,
          durationMinutes: booking.durationMinutes,
          stepMinutes: SLOT_STEP_MINUTES,
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
          return fail(409, "COURT_RESOURCE_INVALID", "Sem ligação canónica entre campo e recurso.");
        }
      }

      const scopeIdForConflict = availabilityMode === "RESOURCE" ? resourceId : professionalId;
      if (!scopeIdForConflict) {
        const conflict = agendaConflictResponse();
        return fail(503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
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
      return fail(409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }

    if (conflictDecision && !conflictDecision.allowed) {
      const conflict = agendaConflictResponse(conflictDecision);
      return fail(409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }
    if (availabilityMode === "HYBRID" && (!professionalId || !resourceId)) {
      return fail(409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem par disponível.");
    }
    if (availabilityMode === "HYBRID" && assignmentConfig.isCourtService && !nextCourtId) {
      return fail(409, "COURT_RESOURCE_INVALID", "Sem ligação canónica entre campo e recurso.");
    }

    const { booking: updated } = await updateBooking({
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId: user.id,
      data: {
        startsAt,
        professionalId,
        resourceId,
        courtId:
          availabilityMode === "RESOURCE" || availabilityMode === "HYBRID"
            ? nextCourtId
            : booking.courtId ?? null,
        partySize,
      },
      select: { id: true, startsAt: true, status: true },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: booking.organizationId,
      actorUserId: user.id,
      action: "BOOKING_RESCHEDULED",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        previousStartsAt: booking.startsAt.toISOString(),
        nextStartsAt: startsAt.toISOString(),
        source: "USER",
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {
      booking: { id: updated.id, status: updated.status, startsAt: updated.startsAt },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/me/reservas/[id]/reschedule error:", err);
    return fail(500, "BOOKING_RESCHEDULE_FAILED", "Erro ao reagendar reserva.");
  }
}

export const POST = withApiEnvelope(_POST);
