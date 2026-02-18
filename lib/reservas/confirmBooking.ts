import type { Prisma } from "@prisma/client";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
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
  const assignmentMode = assignmentConfig.mode;
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

  const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
  let candidateScopes: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = [];
  let assignedProfessionalId = booking.professionalId ?? null;
  let assignedResourceId = assignmentConfig.isCourtService ? booking.resourceId ?? null : null;
  let assignedCourtId = booking.courtId ?? null;
  const resourceCourtById = new Map<number, number | null>();
  const enforceServiceResourceLinks = !assignmentConfig.isCourtService;

  if (assignmentMode === "RESOURCE") {
    const partySize = booking.partySize;
    if (!partySize || partySize < 1) {
      return { ok: false, code: "INVALID_CAPACITY", message: "Capacidade inválida." };
    }
    if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
    }
    if (assignedResourceId) {
      const linkedResource = await tx.reservationResource.findFirst({
        where: { id: assignedResourceId, organizationId: booking.organizationId, isActive: true },
        select: { id: true, courtId: true },
      });
      if (!linkedResource) {
        return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
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
      candidateScopes = [{ scopeType: "RESOURCE", scopeId: assignedResourceId }];
    } else {
      const resources = await tx.reservationResource.findMany({
        where: {
          organizationId: booking.organizationId,
          isActive: true,
          capacity: { gte: partySize },
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
          ...(enforceServiceResourceLinks && allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true, courtId: true },
      });
      resources.forEach((resource) => {
        resourceCourtById.set(resource.id, resource.courtId ?? null);
      });
      candidateScopes = resources.map((resource) => ({ scopeType: "RESOURCE", scopeId: resource.id }));
    }
  } else {
    if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem profissionais disponíveis." };
    }
    if (assignedProfessionalId && allowedProfessionalIds && !allowedProfessionalIds.includes(assignedProfessionalId)) {
      return { ok: false, code: "SLOT_TAKEN", message: "Profissional indisponível." };
    }
    if (assignedProfessionalId) {
      candidateScopes = [{ scopeType: "PROFESSIONAL", scopeId: assignedProfessionalId }];
    } else {
      const professionals = await tx.reservationProfessional.findMany({
        where: {
          organizationId: booking.organizationId,
          isActive: true,
          ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
        },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      candidateScopes = professionals.map((professional) => ({
        scopeType: "PROFESSIONAL",
        scopeId: professional.id,
      }));
    }
  }

  if (candidateScopes.length === 0) {
    return { ok: false, code: "SLOT_TAKEN", message: "Sem disponibilidade para este serviço." };
  }

  const conflictScopeIds = candidateScopes.map((scope) => scope.scopeId);
  const scopedConflictFilter =
    assignmentMode === "RESOURCE"
      ? { resourceId: { in: conflictScopeIds } }
      : { professionalId: { in: conflictScopeIds } };
  const shouldUseOrgOnly = false;
  const [templates, overrides, blocking, classSessions] = await Promise.all([
    tx.weeklyAvailabilityTemplate.findMany({
      where: {
        organizationId: booking.organizationId,
        ...(shouldUseOrgOnly
          ? { scopeType: "ORGANIZATION", scopeId: 0 }
          : {
              OR: [
                { scopeType: "ORGANIZATION", scopeId: 0 },
                { scopeType, scopeId: { in: conflictScopeIds } },
              ],
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
              OR: [
                { scopeType: "ORGANIZATION", scopeId: 0 },
                { scopeType, scopeId: { in: conflictScopeIds } },
              ],
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
        ...scopedConflictFilter,
        NOT: { id: booking.id },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
        ],
      },
      select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
    }),
    assignmentMode === "PROFESSIONAL"
      ? tx.classSession.findMany({
        where: {
          organizationId: booking.organizationId,
          status: "SCHEDULED",
          startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
          endsAt: { gt: conflictWindowStart },
          ...(conflictScopeIds.length > 0 ? { professionalId: { in: conflictScopeIds } } : {}),
        },
        select: { startsAt: true, endsAt: true, professionalId: true },
      })
      : Promise.resolve([]),
  ]);

  const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const templatesByScope = groupByScope(templates);
  const overridesByScope = groupByScope(overrides);
  const blocks = [...buildBlocks(blocking), ...buildSessionBlocks(classSessions)];
  const slotKey = booking.startsAt.toISOString();
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

  if (assignmentMode === "RESOURCE") {
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
      courtId: assignmentMode === "RESOURCE" ? assignedCourtId : booking.courtId ?? null,
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
