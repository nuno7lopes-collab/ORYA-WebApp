import type { Prisma } from "@prisma/client";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";

const SLOT_STEP_MINUTES = 15;

type ConfirmBookingResult =
  | { ok: true; bookingId: number; alreadyConfirmed: boolean; professionalId: number | null; resourceId: number | null }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS" | "SLOT_TAKEN" | "INVALID_CAPACITY" | "SERVICE_INACTIVE"; message: string };

type ConfirmBookingParams = {
  tx: Prisma.TransactionClient;
  bookingId: number;
  now?: Date;
  ignoreExpiry?: boolean;
};

function buildBlocks(bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>) {
  return bookings.map((booking) => ({
    start: booking.startsAt,
    end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
  }));
}

async function resolvePolicyId(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  servicePolicyId?: number | null;
}) {
  if (params.servicePolicyId) {
    const policy = await params.tx.organizationPolicy.findFirst({
      where: { id: params.servicePolicyId, organizationId: params.organizationId },
      select: { id: true },
    });
    if (policy) return policy.id;
  }

  const fallback =
    (await params.tx.organizationPolicy.findFirst({
      where: { organizationId: params.organizationId, policyType: "MODERATE" },
      select: { id: true },
    })) ??
    (await params.tx.organizationPolicy.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));

  return fallback?.id ?? null;
}

export async function confirmPendingBooking({
  tx,
  bookingId,
  now = new Date(),
  ignoreExpiry = false,
}: ConfirmBookingParams): Promise<ConfirmBookingResult> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      policyRef: { select: { id: true } },
      service: {
        select: {
          id: true,
          policyId: true,
          kind: true,
          isActive: true,
          organizationId: true,
          professionalLinks: {
            select: { professionalId: true, professional: { select: { isActive: true } } },
          },
          resourceLinks: {
            select: { resourceId: true, resource: { select: { isActive: true } } },
          },
          organization: {
            select: {
              primaryModule: true,
              reservationAssignmentMode: true,
              timezone: true,
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
    serviceKind: booking.service.kind ?? null,
  });
  const assignmentMode = assignmentConfig.mode;
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
  const timezone = booking.snapshotTimezone || booking.service.organization?.timezone || "Europe/Lisbon";
  const dayParts = getDateParts(booking.startsAt, timezone);
  const dayStart = makeUtcDateFromLocal({ ...dayParts, hour: 0, minute: 0 }, timezone);
  const dayEnd = makeUtcDateFromLocal({ ...dayParts, hour: 23, minute: 59 }, timezone);

  let scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
  let candidateScopes: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = [];
  let assignedProfessionalId = booking.professionalId ?? null;
  let assignedResourceId = assignmentConfig.isCourtService ? booking.resourceId ?? null : null;

  if (assignmentMode === "RESOURCE") {
    const partySize = booking.partySize;
    if (!partySize || partySize < 1) {
      return { ok: false, code: "INVALID_CAPACITY", message: "Capacidade inválida." };
    }
    if (allowedResourceIds && allowedResourceIds.length === 0) {
      return { ok: false, code: "SLOT_TAKEN", message: "Sem recursos disponíveis." };
    }
    if (assignedResourceId && allowedResourceIds && !allowedResourceIds.includes(assignedResourceId)) {
      return { ok: false, code: "SLOT_TAKEN", message: "Recurso indisponível." };
    }
    if (assignedResourceId) {
      candidateScopes = [{ scopeType: "RESOURCE", scopeId: assignedResourceId }];
    } else {
      const resources = await tx.reservationResource.findMany({
        where: {
          organizationId: booking.organizationId,
          isActive: true,
          capacity: { gte: partySize },
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true },
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

  const shouldUseOrgOnly = false;
  const [templates, overrides, blocking] = await Promise.all([
    tx.weeklyAvailabilityTemplate.findMany({
      where: {
        organizationId: booking.organizationId,
        ...(shouldUseOrgOnly
          ? { scopeType: "ORGANIZATION", scopeId: 0 }
          : {
              OR: [
                { scopeType: "ORGANIZATION", scopeId: 0 },
                { scopeType, scopeId: { in: candidateScopes.map((scope) => scope.scopeId) } },
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
                { scopeType, scopeId: { in: candidateScopes.map((scope) => scope.scopeId) } },
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
        startsAt: { lt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000) },
        NOT: { id: booking.id },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
        ],
      },
      select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
    }),
  ]);

  const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
  const templatesByScope = groupByScope(templates);
  const overridesByScope = groupByScope(overrides);
  const blocks = buildBlocks(blocking);
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
  } else {
    assignedProfessionalId = assignedScope.scopeType === "PROFESSIONAL" ? assignedScope.scopeId : null;
  }

  const updated = await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      pendingExpiresAt: null,
      assignmentMode,
      professionalId: assignedProfessionalId,
      resourceId: assignedResourceId,
    },
    select: { id: true },
  });

  if (!booking.policyRef) {
    const policyId = await resolvePolicyId({
      tx,
      organizationId: booking.organizationId,
      servicePolicyId: booking.service.policyId ?? undefined,
    });
    if (policyId) {
      await tx.bookingPolicyRef.create({
        data: { bookingId: booking.id, policyId },
      });
    }
  }

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

  return {
    ok: true,
    bookingId: updated.id,
    alreadyConfirmed: false,
    professionalId: assignedProfessionalId,
    resourceId: assignedResourceId,
  };
}
