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
  type ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { OrganizationMemberRole } from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { updateBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      include: {
        professional: { select: { userId: true } },
        resource: { select: { id: true, capacity: true } },
        service: {
          select: {
            id: true,
            organizationId: true,
            kind: true,
            durationMinutes: true,
            professionalLinks: { select: { professionalId: true, professional: { select: { isActive: true } } } },
            resourceLinks: { select: { resourceId: true, resource: { select: { isActive: true, capacity: true } } } },
            organization: { select: { timezone: true, reservationAssignmentMode: true } },
          },
        },
      },
    });

    if (!booking) {
      return fail(ctx, 404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
    }
    if (
      membership.role === OrganizationMemberRole.STAFF &&
      (!booking.professional?.userId || booking.professional.userId !== profile.id)
    ) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(booking.status)) {
      return fail(ctx, 409, "BOOKING_CLOSED", "Reserva já encerrada.");
    }

    const timezone = booking.service.organization?.timezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return fail(ctx, 400, "INVALID_TIME_SLOT", "Horário fora da grelha de 15 minutos.");
    }

    if (startsAt <= new Date()) {
      return fail(ctx, 400, "TIME_PASSED", "Este horário já passou.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: booking.service.organization?.reservationAssignmentMode ?? null,
      serviceKind: booking.service.kind ?? null,
    });
    const assignmentMode = booking.assignmentMode ?? assignmentConfig.mode;
    if (!assignmentConfig.isCourtService && assignmentMode === "RESOURCE") {
      const blocked = getResourceModeBlockedPayload();
      return fail(
        ctx,
        409,
        blocked.error ?? "RESOURCE_MODE_NOT_ALLOWED",
        blocked.message ?? "Este serviço não permite reservas por recurso.",
      );
    }

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

    let professionalId: number | null = booking.professionalId ?? null;
    let resourceId: number | null = booking.resourceId ?? null;
    const partySize: number | null = booking.partySize ?? null;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (!partySize) {
        return fail(ctx, 400, "CAPACITY_REQUIRED", "Capacidade obrigatória.");
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        if (allowedResourceIds && !allowedResourceIds.includes(resourceId)) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, capacity: true },
        });
        if (!resource) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (resource.capacity < partySize) {
          return fail(ctx, 400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        scopeIds = [resource.id];
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.service.organizationId,
            isActive: true,
            capacity: { gte: partySize },
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = resources.map((resource) => resource.id);
      }
    } else {
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
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
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    if (scopeIds.length === 0) {
      return fail(ctx, 409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    const bookingEndsAt = new Date(startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const [templates, overrides, blockingBookings, softBlocks] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: {
          organizationId: booking.service.organizationId,
          OR: [
            { scopeType: "ORGANIZATION", scopeId: 0 },
            { scopeType, scopeId: { in: scopeIds } },
          ],
        },
        select: { scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: booking.service.organizationId,
          OR: [
            { scopeType: "ORGANIZATION", scopeId: 0 },
            { scopeType, scopeId: { in: scopeIds } },
          ],
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: booking.service.organizationId,
          id: { not: booking.id },
          startsAt: { lt: bookingEndsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: new Date() } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      prisma.softBlock.findMany({
        where: {
          organizationId: booking.service.organizationId,
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
    const scopesToCheck = scopeIds.map((id) => ({ scopeType, scopeId: id, assignable: true }));
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;

    for (const scope of scopesToCheck) {
      const slots = getAvailableSlotsForScope({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: booking.durationMinutes,
        stepMinutes: SLOT_STEP_MINUTES,
        now: new Date(),
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
        assignedScopeId = scope.scopeId;
        break;
      }
    }

    if (!slotIsAvailable) {
      return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }

    if (assignmentMode === "RESOURCE" && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (assignmentMode === "PROFESSIONAL" && assignedScopeId) {
      professionalId = assignedScopeId;
    }

    const scopeIdForConflict = assignmentMode === "RESOURCE" ? resourceId : professionalId;
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
        assignmentMode === "RESOURCE" ? item.resourceId === scopeIdForConflict : item.professionalId === scopeIdForConflict,
      )
      .map((item) => ({
        type: "BOOKING" as const,
        sourceId: String(item.id),
        startsAt: item.startsAt,
        endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
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

    const { ip, userAgent } = getRequestMeta(req);
    const { booking: updated } = await updateBooking({
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId: profile.id,
      data: {
        startsAt,
        professionalId,
        resourceId,
        partySize,
      },
      select: { id: true, startsAt: true, status: true, professionalId: true, resourceId: true },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "BOOKING_RESCHEDULED",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        previousStartsAt: booking.startsAt.toISOString(),
        nextStartsAt: startsAt.toISOString(),
        actorRole: membership.role,
      },
      ip,
      userAgent,
    });

    if (booking.userId) {
      const shouldSend = await shouldNotify(booking.userId, "SYSTEM_ANNOUNCE");
      if (shouldSend) {
        await createNotification({
          userId: booking.userId,
          type: "SYSTEM_ANNOUNCE",
          title: "Reserva reagendada",
          body: `Nova data: ${startsAt.toLocaleString("pt-PT", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          ctaUrl: "/me/reservas",
          ctaLabel: "Ver reservas",
          organizationId: organization.id,
        });
      }
    }

    return respondOk(ctx, { booking: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/organizacao/reservas/[id]/reschedule error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao reagendar reserva.");
  }
}

export const POST = withApiEnvelope(_POST);
