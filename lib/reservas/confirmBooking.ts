import type { BookingStatus, Prisma } from "@prisma/client";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import {
  buildHybridSlotMatrix,
  selectBestHybridPairForSlot,
} from "@/lib/reservas/hybridAssignment";
import {
  resolveServicePartySizeRules,
  validateRequestedPartySize,
} from "@/lib/reservas/servicePartySize";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
  type BookingConfirmationPaymentMeta,
} from "@/lib/reservas/confirmationSnapshot";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";

const SLOT_STEP_MINUTES = 5;

type ConfirmBookingResult =
  | { ok: true; bookingId: number; alreadyConfirmed: boolean; professionalId: number | null; resourceId: number | null }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "INVALID_STATUS"
        | "SLOT_TAKEN"
        | "INVALID_CAPACITY"
        | "SERVICE_INACTIVE"
        | "POLICY_SNAPSHOT_MISSING"
        | "PRICING_SNAPSHOT_MISSING";
      message: string;
    };

type ConfirmBookingParams = {
  tx: Prisma.TransactionClient;
  bookingId: number;
  now?: Date;
  ignoreExpiry?: boolean;
  paymentMeta?: BookingConfirmationPaymentMeta | null;
};

function buildBlocks(bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>) {
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

const toInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const extractPolicyIdFromSnapshot = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object") return null;
  const policyId = toInt((snapshot as any)?.policySnapshot?.policyId);
  return policyId && policyId > 0 ? policyId : null;
};

const extractSnapshotCreatedAt = (snapshot: unknown, fallback: Date) => {
  if (!snapshot || typeof snapshot !== "object") return fallback;
  const raw = (snapshot as any)?.createdAt;
  if (typeof raw !== "string") return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export async function confirmPendingBooking({
  tx,
  bookingId,
  now = new Date(),
  ignoreExpiry = false,
  paymentMeta = null,
}: ConfirmBookingParams): Promise<ConfirmBookingResult> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      organizationId: true,
      serviceId: true,
      userId: true,
      status: true,
      startsAt: true,
      durationMinutes: true,
      partySize: true,
      professionalId: true,
      resourceId: true,
      courtId: true,
      price: true,
      currency: true,
      pendingExpiresAt: true,
      createdAt: true,
      snapshotTimezone: true,
      confirmationSnapshot: true,
      confirmationSnapshotCreatedAt: true,
      confirmationSnapshotVersion: true,
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
      policyRef: { select: { id: true, policyId: true } },
      service: {
        select: {
          id: true,
          policyId: true,
          kind: true,
          assignmentMode: true,
          partySizeRequired: true,
          partySizeMin: true,
          partySizeMax: true,
          partySizeStep: true,
          isActive: true,
          unitPriceCents: true,
          currency: true,
          organizationId: true,
          professionalLinks: {
            select: { professionalId: true, professional: { select: { isActive: true } } },
          },
          resourceLinks: {
            select: { resourceId: true, resource: { select: { isActive: true, courtId: true } } },
          },
          organization: {
            select: {
              primaryModule: true,
              reservationAssignmentMode: true,
              timezone: true,
              feeMode: true,
              platformFeeBps: true,
              platformFeeFixedCents: true,
              orgType: true,
            },
          },
        },
      },
    },
  });

  if (!booking || !booking.service) {
    return { ok: false, code: "NOT_FOUND", message: "Reserva não encontrada." };
  }

  const reservasAccess = await ensureReservasModuleAccess(
    {
      id: booking.organizationId,
      primaryModule: booking.service.organization?.primaryModule ?? null,
    },
    tx,
  );

  if (!booking.service.isActive || !reservasAccess.ok) {
    return { ok: false, code: "SERVICE_INACTIVE", message: "Serviço inativo." };
  }

  if (booking.status === "CONFIRMED") {
    return {
      ok: true,
      bookingId: booking.id,
      alreadyConfirmed: true,
      professionalId: booking.professionalId ?? null,
      resourceId: booking.resourceId ?? null,
    };
  }

  if (!["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return { ok: false, code: "INVALID_STATUS", message: "Reserva não pode ser confirmada." };
  }

  const expiry = booking.pendingExpiresAt ?? new Date(booking.createdAt.getTime() + 10 * 60 * 1000);
  if (!ignoreExpiry && expiry < now) {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED_BY_CLIENT" },
    });
    return { ok: false, code: "INVALID_STATUS", message: "Pré-reserva expirada." };
  }

  const lockKey = `booking:${booking.organizationId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const assignmentConfig = resolveServiceAssignmentMode({
    organizationMode: booking.service.organization?.reservationAssignmentMode ?? null,
    serviceMode: booking.service.assignmentMode ?? null,
    serviceKind: booking.service.kind ?? null,
  });
  const availabilityMode = assignmentConfig.availabilityMode;
  const partySizeRules = resolveServicePartySizeRules({
    assignmentMode: assignmentConfig.assignmentMode,
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
    return { ok: false, code: "INVALID_CAPACITY", message: partySizeValidation.message };
  }
  const partySize = partySizeValidation.partySize;
  const bookingAssignmentMode = assignmentConfig.assignmentMode;
  const allowedProfessionalIds = booking.service.professionalLinks.length
    ? booking.service.professionalLinks
        .filter((link) => link.professional?.isActive)
        .map((link) => link.professionalId)
    : null;
  const allowedResourceIds = booking.service.resourceLinks.length
    ? booking.service.resourceLinks
        .filter((link) => link.resource?.isActive)
        .map((link) => link.resourceId)
    : null;
  const allowedCourtIdsFromService = booking.service.resourceLinks.length
    ? booking.service.resourceLinks
        .filter((link) => link.resource?.isActive && (link.resource?.courtId ?? null) != null)
        .map((link) => link.resource?.courtId)
        .filter((value): value is number => typeof value === "number" && value > 0)
    : null;
  const timezone = booking.snapshotTimezone || booking.service.organization?.timezone || "Europe/Lisbon";
  const dayParts = getDateParts(booking.startsAt, timezone);
  const dayStart = makeUtcDateFromLocal({ ...dayParts, hour: 0, minute: 0 }, timezone);
  const dayEnd = makeUtcDateFromLocal({ ...dayParts, hour: 23, minute: 59 }, timezone);
  const conflictWindowStart = getConflictWindowStart(dayStart);
  const bookingEndsAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);

  const scopeType: AvailabilityScopeType = availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
  let candidateScopes: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = [];
  let assignedProfessionalId = booking.professionalId ?? null;
  let assignedResourceId = booking.resourceId ?? null;
  let assignedCourtId = booking.courtId ?? null;
  const resourceCourtById = new Map<number, number | null>();
  const enforceServiceResourceLinks = !assignmentConfig.isCourtService;
  let professionalScopes: Array<{ id: number; priority: number }> = [];
  let resourceScopes: Array<{ id: number; capacity: number; priority: number; courtId: number | null }> = [];

  if (availabilityMode === "RESOURCE") {
    if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
    }
    if (assignedResourceId) {
      const linkedResource = await tx.reservationResource.findFirst({
        where: { id: assignedResourceId, organizationId: booking.organizationId, isActive: true },
        select: { id: true, capacity: true, priority: true, courtId: true },
      });
      if (!linkedResource) {
        return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
      }
      if (partySize != null && linkedResource.capacity < partySize) {
        return { ok: false, code: "INVALID_CAPACITY", message: "Capacidade acima do recurso." };
      }
      if (assignmentConfig.isCourtService) {
        if (!linkedResource.courtId) {
          return { ok: false, code: "SLOT_TAKEN", message: "Recurso sem ligação canónica a campo." };
        }
        if (
          allowedCourtIdsFromService &&
          allowedCourtIdsFromService.length > 0 &&
          !allowedCourtIdsFromService.includes(linkedResource.courtId) &&
          !(allowedResourceIds?.includes(linkedResource.id) ?? false)
        ) {
          return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
        }
      } else if (enforceServiceResourceLinks && allowedResourceIds && !allowedResourceIds.includes(linkedResource.id)) {
        return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
      }
      resourceCourtById.set(linkedResource.id, linkedResource.courtId ?? null);
      resourceScopes = [linkedResource];
      candidateScopes = [{ scopeType: "RESOURCE", scopeId: assignedResourceId }];
    } else {
      const resources = await tx.reservationResource.findMany({
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
      candidateScopes = resources.map((resource) => ({ scopeType: "RESOURCE", scopeId: resource.id }));
    }
  } else if (availabilityMode === "PROFESSIONAL") {
    if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem profissionais disponíveis." };
    }
    if (assignedProfessionalId && allowedProfessionalIds && !allowedProfessionalIds.includes(assignedProfessionalId)) {
      return { ok: false, code: "SLOT_TAKEN", message: "Profissional indisponível." };
    }
    if (assignedProfessionalId) {
      const professional = await tx.reservationProfessional.findFirst({
        where: { id: assignedProfessionalId, organizationId: booking.organizationId, isActive: true },
        select: { id: true, priority: true },
      });
      if (!professional) {
        return { ok: false, code: "SLOT_TAKEN", message: "Profissional indisponível." };
      }
      professionalScopes = [professional];
      candidateScopes = [{ scopeType: "PROFESSIONAL", scopeId: assignedProfessionalId }];
    } else {
      const professionals = await tx.reservationProfessional.findMany({
        where: {
          organizationId: booking.organizationId,
          isActive: true,
          ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
        },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        select: { id: true, priority: true },
      });
      professionalScopes = professionals;
      candidateScopes = professionals.map((professional) => ({
        scopeType: "PROFESSIONAL",
        scopeId: professional.id,
      }));
    }
  } else {
    if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem profissionais disponíveis." };
    }
    if (assignedProfessionalId && allowedProfessionalIds && !allowedProfessionalIds.includes(assignedProfessionalId)) {
      assignedProfessionalId = null;
    }
    if (assignedProfessionalId) {
      const professional = await tx.reservationProfessional.findFirst({
        where: { id: assignedProfessionalId, organizationId: booking.organizationId, isActive: true },
        select: { id: true, priority: true },
      });
      if (professional) professionalScopes = [professional];
    }
    if (professionalScopes.length === 0) {
      professionalScopes = await tx.reservationProfessional.findMany({
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
      return { ok: false, code: "SLOT_TAKEN", message: "Sem profissionais disponíveis." };
    }

    if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
    }
    if (assignedResourceId) {
      const linkedResource = await tx.reservationResource.findFirst({
        where: { id: assignedResourceId, organizationId: booking.organizationId, isActive: true },
        select: { id: true, capacity: true, priority: true, courtId: true },
      });
      if (linkedResource) {
        if (partySize != null && linkedResource.capacity < partySize) {
          return { ok: false, code: "INVALID_CAPACITY", message: "Capacidade acima do recurso." };
        }
        if (
          assignmentConfig.isCourtService &&
          (!linkedResource.courtId ||
            (allowedCourtIdsFromService &&
              allowedCourtIdsFromService.length > 0 &&
              !allowedCourtIdsFromService.includes(linkedResource.courtId) &&
              !(allowedResourceIds?.includes(linkedResource.id) ?? false)))
        ) {
          return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
        }
        if (enforceServiceResourceLinks && allowedResourceIds && !allowedResourceIds.includes(linkedResource.id)) {
          return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
        }
        resourceScopes = [linkedResource];
        resourceCourtById.set(linkedResource.id, linkedResource.courtId ?? null);
      } else {
        assignedResourceId = null;
      }
    }
    if (resourceScopes.length === 0) {
      resourceScopes = await tx.reservationResource.findMany({
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
      return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
    }
  }

  if (availabilityMode !== "HYBRID" && candidateScopes.length === 0) {
    return { ok: false, code: "SLOT_TAKEN", message: "Sem disponibilidade para este serviço." };
  }

  const professionalScopeIds =
    availabilityMode === "HYBRID"
      ? professionalScopes.map((professional) => professional.id)
      : availabilityMode === "PROFESSIONAL"
        ? candidateScopes.map((scope) => scope.scopeId)
        : [];
  const resourceScopeIds =
    availabilityMode === "HYBRID"
      ? resourceScopes.map((resource) => resource.id)
      : availabilityMode === "RESOURCE"
        ? candidateScopes.map((scope) => scope.scopeId)
        : [];
  const conflictScopeIds =
    availabilityMode === "RESOURCE" ? resourceScopeIds : professionalScopeIds;
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
  const shouldUseOrgOnly = false;
  const activeBookingFilter = {
    // Keep status arrays mutable for Prisma's generated enum filter type.
    OR: (() => {
      const activeBookedStatuses: BookingStatus[] = ["CONFIRMED", "DISPUTED", "NO_SHOW"];
      const activePendingStatuses: BookingStatus[] = ["PENDING_CONFIRMATION", "PENDING"];
      return [
        { status: { in: activeBookedStatuses } },
        { status: { in: activePendingStatuses }, pendingExpiresAt: { gt: now } },
      ];
    })(),
  };
  const templateScopeFilters =
    availabilityMode === "HYBRID"
      ? [
          { scopeType: "ORGANIZATION" as const, scopeId: 0 },
          { scopeType: "PROFESSIONAL" as const, scopeId: { in: professionalScopeIds } },
          { scopeType: "RESOURCE" as const, scopeId: { in: resourceScopeIds } },
        ]
      : [
          { scopeType: "ORGANIZATION" as const, scopeId: 0 },
          { scopeType, scopeId: { in: conflictScopeIds } },
        ];
  const [templates, overrides, blocking, classSessions] = await Promise.all([
    tx.weeklyAvailabilityTemplate.findMany({
      where: {
        organizationId: booking.organizationId,
        ...(shouldUseOrgOnly
          ? { scopeType: "ORGANIZATION", scopeId: 0 }
          : {
              OR: templateScopeFilters,
            }),
      },
      select: { scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
    }),
    tx.availabilityOverride.findMany({
      where: {
        organizationId: booking.organizationId,
        ...(shouldUseOrgOnly
          ? { scopeType: "ORGANIZATION", scopeId: 0 }
          : {
              OR: templateScopeFilters,
            }),
        date: new Date(Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day)),
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
    }),
    tx.booking.findMany({
      where: {
        organizationId: booking.organizationId,
        startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
        NOT: { id: booking.id },
        AND: [scopedConflictFilter, activeBookingFilter],
      },
      select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
    }),
    availabilityMode === "RESOURCE"
      ? Promise.resolve([])
      : tx.classSession.findMany({
          where: {
            organizationId: booking.organizationId,
            status: "SCHEDULED",
            startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
            endsAt: { gt: conflictWindowStart },
            ...(professionalScopeIds.length > 0 ? { professionalId: { in: professionalScopeIds } } : {}),
          },
          select: { startsAt: true, endsAt: true, professionalId: true },
        }),
  ]);

  const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const templatesByScope = groupByScope(templates);
  const overridesByScope = groupByScope(overrides);
  const blocks = [...buildBlocks(blocking), ...buildSessionBlocks(classSessions)];
  const slotKey = booking.startsAt.toISOString();

  let allowed = false;

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
      orgTemplates: orgTemplates as ScopedTemplate[],
      orgOverrides: orgOverrides as ScopedOverride[],
      templatesByScope,
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
      return { ok: false, code: "SLOT_TAKEN", message: "Horário já ocupado." };
    }
    assignedProfessionalId = pair.professionalId;
    assignedResourceId = pair.resourceId;
    assignedCourtId = pair.courtId ?? null;
    if (assignmentConfig.isCourtService && !assignedCourtId) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem ligação canónica entre campo e recurso." };
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${booking.serviceId}:${booking.startsAt.toISOString()}`,
      startsAt: booking.startsAt,
      endsAt: bookingEndsAt,
    };
    const professionalExisting: AgendaCandidate[] = blocking
      .filter((entry) => entry.professionalId === assignedProfessionalId)
      .map((entry) => ({
        type: "BOOKING",
        sourceId: entry.startsAt.toISOString(),
        startsAt: entry.startsAt,
        endsAt: new Date(entry.startsAt.getTime() + entry.durationMinutes * 60 * 1000),
      }));
    classSessions.forEach((session) => {
      if (session.professionalId !== assignedProfessionalId) return;
      professionalExisting.push({
        type: "BOOKING",
        sourceId: `class:${session.startsAt.toISOString()}`,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    });
    const resourceExisting: AgendaCandidate[] = blocking
      .filter((entry) => entry.resourceId === assignedResourceId)
      .map((entry) => ({
        type: "BOOKING",
        sourceId: entry.startsAt.toISOString(),
        startsAt: entry.startsAt,
        endsAt: new Date(entry.startsAt.getTime() + entry.durationMinutes * 60 * 1000),
      }));
    const proDecision = evaluateCandidate({ candidate, existing: professionalExisting });
    const resourceDecision = evaluateCandidate({ candidate, existing: resourceExisting });
    if (proDecision.allowed && resourceDecision.allowed) {
      allowed = true;
    }
  } else {
    const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = shouldUseOrgOnly
      ? [{ scopeType: "ORGANIZATION", scopeId: 0 }]
      : candidateScopes;

    let assignedScope: { scopeType: AvailabilityScopeType; scopeId: number } | null = null;
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
        orgTemplates: orgTemplates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        templatesByScope,
        overridesByScope,
        blocks,
      });
      if (slots.some((slot) => slot.startsAt.toISOString() === slotKey)) {
        assignedScope = scope;
        break;
      }
    }

    if (!assignedScope) {
      return { ok: false, code: "SLOT_TAKEN", message: "Horário já ocupado." };
    }

    if (availabilityMode === "RESOURCE") {
      assignedResourceId = assignedScope.scopeType === "RESOURCE" ? assignedScope.scopeId : null;
      if (!assignedResourceId) {
        return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
      }
      let linkedCourtId = resourceCourtById.get(assignedResourceId) ?? null;
      if (linkedCourtId == null) {
        const linkedResource = await tx.reservationResource.findUnique({
          where: { id: assignedResourceId },
          select: { courtId: true },
        });
        linkedCourtId = linkedResource?.courtId ?? null;
      }
      assignedCourtId = assignmentConfig.isCourtService ? linkedCourtId : null;
      if (assignmentConfig.isCourtService && !assignedCourtId) {
        return { ok: false, code: "SLOT_TAKEN", message: "Sem ligação canónica entre campo e recurso." };
      }
    } else {
      assignedProfessionalId = assignedScope.scopeType === "PROFESSIONAL" ? assignedScope.scopeId : null;
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${booking.serviceId}:${booking.startsAt.toISOString()}`,
      startsAt: booking.startsAt,
      endsAt: bookingEndsAt,
    };
    const existingByScope = new Map<number, AgendaCandidate[]>();
    conflictScopeIds.forEach((id) => existingByScope.set(id, []));
    blocking.forEach((entry) => {
      const scopeId = availabilityMode === "RESOURCE" ? entry.resourceId : entry.professionalId;
      if (!scopeId) return;
      const bucket = existingByScope.get(scopeId);
      if (!bucket) return;
      const end = new Date(entry.startsAt.getTime() + entry.durationMinutes * 60 * 1000);
      bucket.push({
        type: "BOOKING",
        sourceId: entry.startsAt.toISOString(),
        startsAt: entry.startsAt,
        endsAt: end,
      });
    });
    if (availabilityMode === "PROFESSIONAL") {
      classSessions.forEach((session) => {
        const scopeId = session.professionalId;
        if (!scopeId) return;
        const bucket = existingByScope.get(scopeId);
        if (!bucket) return;
        bucket.push({
          type: "BOOKING",
          sourceId: `class:${session.startsAt.toISOString()}`,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
        });
      });
    }
    for (const scopeId of conflictScopeIds) {
      const existing = existingByScope.get(scopeId) ?? [];
      const decision = evaluateCandidate({ candidate, existing });
      if (decision.allowed) {
        allowed = true;
        break;
      }
    }
  }

  if (!allowed) {
    return { ok: false, code: "SLOT_TAKEN", message: "Horário já ocupado." };
  }

  const existingSnapshot = booking.confirmationSnapshot ?? null;
  const existingPolicyId = extractPolicyIdFromSnapshot(existingSnapshot);
  const snapshotResult =
    existingSnapshot
      ? { ok: true as const, snapshot: existingSnapshot, policyId: existingPolicyId }
      : await buildBookingConfirmationSnapshot({
          tx,
          booking,
          now,
          policyIdHint: booking.policyRef?.policyId ?? null,
          paymentMeta,
        });
  if (!snapshotResult.ok) {
    const message =
      snapshotResult.code === "POLICY_SNAPSHOT_MISSING"
        ? "Não foi possível fixar a política da reserva."
        : "Não foi possível fixar o preço da reserva.";
    return { ok: false, code: snapshotResult.code, message };
  }

  const snapshot = snapshotResult.snapshot;
  const snapshotPolicyId = extractPolicyIdFromSnapshot(snapshot) ?? snapshotResult.policyId;
  if (!snapshotPolicyId) {
    return {
      ok: false,
      code: "POLICY_SNAPSHOT_MISSING",
      message: "Não foi possível fixar a política da reserva.",
    };
  }

  const snapshotCreatedAt =
    booking.confirmationSnapshotCreatedAt ?? extractSnapshotCreatedAt(snapshot, now);
  const snapshotVersion =
    booking.confirmationSnapshotVersion ??
    toInt((snapshot as any)?.version) ??
    BOOKING_CONFIRMATION_SNAPSHOT_VERSION;

  const updated = await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      pendingExpiresAt: null,
      assignmentMode: bookingAssignmentMode,
      professionalId: assignedProfessionalId,
      resourceId: assignedResourceId,
      courtId:
        availabilityMode === "RESOURCE" || availabilityMode === "HYBRID"
          ? assignedCourtId
          : booking.courtId ?? null,
      confirmationSnapshot: snapshot,
      confirmationSnapshotVersion: snapshotVersion,
      confirmationSnapshotCreatedAt: snapshotCreatedAt,
    },
    select: { id: true },
  });

  if (!booking.policyRef) {
    await tx.bookingPolicyRef.create({
      data: { bookingId: booking.id, policyId: snapshotPolicyId },
    });
  }

  if (booking.userId) {
    await tx.userActivity.create({
      data: {
        userId: booking.userId,
        type: "BOOKING_CREATED",
        visibility: "PRIVATE",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          organizationId: booking.organizationId,
        },
      },
    });
  }

  return {
    ok: true,
    bookingId: updated.id,
    alreadyConfirmed: false,
    professionalId: assignedProfessionalId,
    resourceId: assignedResourceId,
  };
}
