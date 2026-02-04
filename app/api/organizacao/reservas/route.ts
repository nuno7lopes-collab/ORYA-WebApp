import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { OrganizationMemberRole } from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { loadScheduleDelays, resolveBookingDelay } from "@/lib/reservas/scheduleDelay";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const PENDING_HOLD_MINUTES = 10;
const SLOT_STEP_MINUTES = 15;

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

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;
    const rangeFilter =
      (fromDate && !Number.isNaN(fromDate.getTime())) || (toDate && !Number.isNaN(toDate.getTime()))
        ? {
            startsAt: {
              ...(fromDate && !Number.isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
              ...(toDate && !Number.isNaN(toDate.getTime()) ? { lt: toDate } : {}),
            },
          }
        : {};
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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

    const assignmentMode =
      (organization as { reservationAssignmentMode?: string | null }).reservationAssignmentMode ??
      "PROFESSIONAL";
    let staffProfessionalIds: number[] | null = null;
    if (membership.role === OrganizationMemberRole.STAFF && assignmentMode === "PROFESSIONAL") {
      const staffProfessionals = await prisma.reservationProfessional.findMany({
        where: { organizationId: organization.id, userId: profile.id, isActive: true },
        select: { id: true },
      });
      staffProfessionalIds = staffProfessionals.map((item) => item.id);
      if (staffProfessionalIds.length === 0) {
        return respondOk(ctx, { items: [] });
      }
    }

    const items = await prisma.booking.findMany({
      where: {
        organizationId: organization.id,
        ...rangeFilter,
        ...(staffProfessionalIds ? { professionalId: { in: staffProfessionalIds } } : {}),
        status: {
          in: [
            "PENDING_CONFIRMATION",
            "PENDING",
            "CONFIRMED",
            "CANCELLED_BY_CLIENT",
            "CANCELLED_BY_ORG",
            "CANCELLED",
            "COMPLETED",
            "NO_SHOW",
            "DISPUTED",
          ],
        },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
        assignmentMode: true,
        partySize: true,
        court: { select: { id: true, name: true } },
        professional: {
          select: {
            id: true,
            name: true,
            user: { select: { fullName: true, avatarUrl: true } },
          },
        },
        resource: {
          select: {
            id: true,
            label: true,
            capacity: true,
          },
        },
        service: {
          select: {
            id: true,
            title: true,
            kind: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        invites: {
          select: { status: true },
        },
        participants: {
          select: { status: true },
        },
      },
    });

    const professionalIds = Array.from(
      new Set(items.map((item) => item.professional?.id).filter((id): id is number => typeof id === "number")),
    );
    const resourceIds = Array.from(
      new Set(items.map((item) => item.resource?.id).filter((id): id is number => typeof id === "number")),
    );
    const delayMap = await loadScheduleDelays({
      tx: prisma,
      organizationId: organization.id,
      professionalIds,
      resourceIds,
    });
    const itemsWithDelay = items.map((item) => {
      const delay = resolveBookingDelay({
        startsAt: item.startsAt,
        assignmentMode: item.assignmentMode,
        professionalId: item.professional?.id ?? null,
        resourceId: item.resource?.id ?? null,
        delayMap,
      });
      const inviteCounts = item.invites.reduce(
        (acc, invite) => {
          if (invite.status === "ACCEPTED") acc.accepted += 1;
          else if (invite.status === "DECLINED") acc.declined += 1;
          else acc.pending += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, accepted: 0, declined: 0, pending: 0 },
      );
      const participantCounts = item.participants.reduce(
        (acc, participant) => {
          if (participant.status === "CONFIRMED") acc.confirmed += 1;
          else acc.cancelled += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, confirmed: 0, cancelled: 0 },
      );
      const { invites: _invites, participants: _participants, ...rest } = item;
      return {
        ...rest,
        inviteSummary: inviteCounts,
        participantSummary: participantCounts,
        estimatedStartsAt: delay.estimatedStartsAt ? delay.estimatedStartsAt.toISOString() : null,
        delayMinutes: delay.delayMinutes,
        delayReason: delay.reason,
      };
    });

    return respondOk(ctx, { items: itemsWithDelay });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/organizacao/reservas error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar reservas.");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
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

    const isStaff = membership.role === OrganizationMemberRole.STAFF;
    const staffProfessional = isStaff
      ? await prisma.reservationProfessional.findFirst({
          where: { organizationId: organization.id, userId: profile.id, isActive: true },
          select: { id: true },
        })
      : null;
    if (isStaff && !staffProfessional) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const payload = await req.json().catch(() => ({}));
    const serviceId = Number(payload?.serviceId);
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : null;
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const userId = typeof payload?.userId === "string" ? payload.userId : null;
    const locationTextInputRaw = typeof payload?.locationText === "string" ? payload.locationText.trim() : "";
    const locationTextInput = locationTextInputRaw ? locationTextInputRaw.slice(0, 160) : "";
    const professionalIdRaw = parsePositiveInt(payload?.professionalId);
    const resourceIdRaw = parsePositiveInt(payload?.resourceId);
    const partySizeRaw = parsePositiveInt(payload?.partySize);

    if (!Number.isFinite(serviceId)) {
      return fail(ctx, 400, "INVALID_SERVICE", "Serviço inválido.");
    }
    if (!userId) {
      return fail(ctx, 400, "INVALID_CLIENT", "Cliente inválido.");
    }
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail(ctx, 400, "INVALID_TIME", "Horário inválido.");
    }

    const clientProfile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, contactPhone: true },
    });
    if (!clientProfile) {
      return fail(ctx, 404, "CLIENT_NOT_FOUND", "Cliente não encontrado.");
    }
    if (!clientProfile.contactPhone) {
      return fail(ctx, 400, "PHONE_REQUIRED", "PHONE_REQUIRED");
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: organization.id,
        isActive: true,
      },
      select: {
        id: true,
        organizationId: true,
        kind: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        locationMode: true,
        defaultLocationText: true,
        professionalLinks: {
          select: { professionalId: true, professional: { select: { isActive: true } } },
        },
        resourceLinks: {
          select: { resourceId: true, resource: { select: { isActive: true } } },
        },
        organization: {
          select: { timezone: true, address: true, reservationAssignmentMode: true },
        },
      },
    });

    if (!service) {
      return fail(ctx, 404, "SERVICE_NOT_FOUND", "Serviço não encontrado.");
    }

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return fail(ctx, 400, "INVALID_TIME_SLOT", "Horário fora da grelha de 15 minutos.");
    }

    const now = new Date();
    if (startsAt <= now) {
      return fail(ctx, 400, "TIME_PASSED", "Este horário já passou.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const assignmentMode = assignmentConfig.mode;
    const allowedProfessionalIds = service.professionalLinks.length
      ? service.professionalLinks
          .filter((link) => link.professional?.isActive)
          .map((link) => link.professionalId)
      : null;
    const allowedResourceIds = service.resourceLinks.length
      ? service.resourceLinks
          .filter((link) => link.resource?.isActive)
          .map((link) => link.resourceId)
      : null;
    let professionalId: number | null = null;
    let resourceId: number | null = null;
    let partySize: number | null = null;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (!assignmentConfig.isCourtService && (partySizeRaw || resourceIdRaw)) {
      const blocked = getResourceModeBlockedPayload();
      return fail(
        ctx,
        409,
        blocked.error ?? "RESOURCE_MODE_NOT_ALLOWED",
        blocked.message ?? "Este serviço não permite reservas por recurso.",
      );
    }

    if (assignmentMode === "RESOURCE") {
      if (!partySizeRaw) {
        return fail(ctx, 400, "CAPACITY_REQUIRED", "Capacidade obrigatória.");
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      partySize = partySizeRaw;
      if (resourceIdRaw) {
        if (allowedResourceIds && !allowedResourceIds.includes(resourceIdRaw)) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true, capacity: true },
        });
        if (!resource) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (resource.capacity < partySize) {
          return fail(ctx, 400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        resourceId = resource.id;
        scopeIds = [resource.id];
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            capacity: { gte: partySize },
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = resources.map((resource) => resource.id);
        if (scopeIds.length === 0) {
          return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para esta capacidade.");
        }
      }
    } else {
      if (isStaff && staffProfessional) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(staffProfessional.id)) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        if (professionalIdRaw && professionalIdRaw !== staffProfessional.id) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        professionalId = staffProfessional.id;
        scopeIds = [staffProfessional.id];
      } else if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalId = professional.id;
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(ctx, 409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    if (assignmentMode === "PROFESSIONAL" && scopeIds.length === 0) {
      return fail(ctx, 409, "PROFESSIONALS_MISSING", "Sem profissionais configurados.");
    }

    if (assignmentMode === "RESOURCE" && scopeIds.length === 0) {
      return fail(ctx, 409, "RESOURCES_MISSING", "Sem recursos configurados.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    if (scopeIds.length === 0) {
      return fail(ctx, 409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const shouldUseOrgOnly = false;
    const bookingEndsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);
    const [templates, overrides, blockingBookings, softBlocks] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: {
          organizationId: service.organizationId,
          ...(shouldUseOrgOnly
            ? { scopeType: "ORGANIZATION", scopeId: 0 }
            : {
                OR: [
                  { scopeType: "ORGANIZATION", scopeId: 0 },
                  { scopeType, scopeId: { in: scopeIds } },
                ],
              }),
        },
        select: { scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: service.organizationId,
          ...(shouldUseOrgOnly
            ? { scopeType: "ORGANIZATION", scopeId: 0 }
            : {
                OR: [
                  { scopeType: "ORGANIZATION", scopeId: 0 },
                  { scopeType, scopeId: { in: scopeIds } },
                ],
              }),
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      prisma.softBlock.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt },
          endsAt: { gt: startsAt },
          OR: [
            { scopeType: "ORGANIZATION" },
            ...(scopeIds.length > 0 ? [{ scopeType, scopeId: { in: scopeIds } }] : []),
          ],
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
      }),
    ]);

    const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const templatesByScope = groupByScope(templates);
    const overridesByScope = groupByScope(overrides);
    const blocks = buildBlocks(blockingBookings);

    const slotKey = startsAt.toISOString();
    const scopesToCheck = shouldUseOrgOnly
      ? [{ scopeType: "ORGANIZATION" as const, scopeId: 0, assignable: false }]
      : scopeIds.map((id) => ({ scopeType, scopeId: id, assignable: true }));
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;

    for (const scope of scopesToCheck) {
      const slots = getAvailableSlotsForScope({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: service.durationMinutes,
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
        slotIsAvailable = true;
        if (scope.assignable) {
          assignedScopeId = scope.scopeId;
        }
        break;
      }
    }

    if (!slotIsAvailable) {
      return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }

    if (assignmentMode === "RESOURCE" && !resourceId && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (assignmentMode === "PROFESSIONAL" && !professionalId && assignedScopeId) {
      professionalId = assignedScopeId;
    }

    const scopeIdForConflict = assignmentMode === "RESOURCE" ? resourceId : professionalId;
    if (!scopeIdForConflict) {
      const conflict = agendaConflictResponse();
      return fail(ctx, 503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
      startsAt,
      endsAt: bookingEndsAt,
    };
    const existing: AgendaCandidate[] = blockingBookings
      .filter((booking) =>
        assignmentMode === "RESOURCE" ? booking.resourceId === scopeIdForConflict : booking.professionalId === scopeIdForConflict,
      )
      .map((booking) => ({
        type: "BOOKING" as const,
        sourceId: String(booking.id),
        startsAt: booking.startsAt,
        endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
      }));
    softBlocks.forEach((block) => {
      if (block.scopeType === "ORGANIZATION") {
        existing.push({
          type: "SOFT_BLOCK",
          sourceId: String(block.id),
          startsAt: block.startsAt,
          endsAt: block.endsAt,
        });
        return;
      }
      if (block.scopeId !== scopeIdForConflict) return;
      existing.push({
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });

    const decision = evaluateCandidate({ candidate, existing });
    if (!decision.allowed) {
      const conflict = agendaConflictResponse(decision);
      return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }

    const pendingExpiresAt = new Date(now.getTime() + PENDING_HOLD_MINUTES * 60 * 1000);
    const locationText =
      service.locationMode === "CHOOSE_AT_BOOKING"
        ? locationTextInput || null
        : service.defaultLocationText ?? service.organization?.address ?? null;
    if (service.locationMode === "CHOOSE_AT_BOOKING" && !locationText) {
      return fail(ctx, 400, "LOCATION_REQUIRED", "Local obrigatório para esta marcação.");
    }

    const { booking } = await createBooking({
      organizationId: service.organizationId,
      actorUserId: profile.id,
      data: {
        serviceId: service.id,
        organizationId: service.organizationId,
        userId,
        startsAt,
        durationMinutes: service.durationMinutes,
        price: service.unitPriceCents,
        currency: service.currency,
        status: "PENDING_CONFIRMATION",
        assignmentMode,
        professionalId,
        resourceId,
        partySize,
        pendingExpiresAt,
        snapshotTimezone: timezone,
        locationMode: service.locationMode,
        locationText,
      },
      select: { id: true, status: true, pendingExpiresAt: true },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: service.organizationId,
      actorUserId: profile.id,
      action: "BOOKING_PENDING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
        clientUserId: userId,
      },
    });

    return respondOk(ctx, { booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/organizacao/reservas error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao criar reserva.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
