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
  type ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { updateBooking } from "@/domain/bookings/commands";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  getSnapshotAllowReschedule,
  getSnapshotRescheduleWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { normalizeEmail } from "@/lib/utils/email";

const SLOT_STEP_MINUTES = 15;

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
        partySize: true,
        snapshotTimezone: true,
        confirmationSnapshot: true,
        service: {
          select: {
            id: true,
            kind: true,
            organizationId: true,
            professionalLinks: { select: { professionalId: true, professional: { select: { isActive: true } } } },
            resourceLinks: { select: { resourceId: true, resource: { select: { isActive: true } } } },
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
      return fail(400, "INVALID_TIME_GRID", "Horário fora da grelha de 15 minutos.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: booking.service?.organization?.reservationAssignmentMode ?? null,
      serviceKind: booking.service?.kind ?? "GENERAL",
    });
    const assignmentMode = booking.assignmentMode ?? assignmentConfig.mode;

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

    let professionalId: number | null = booking.professionalId ?? null;
    let resourceId: number | null = booking.resourceId ?? null;
    const partySize: number | null = booking.partySize ?? null;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (!partySize) {
        return fail(400, "CAPACITY_REQUIRED", "Capacidade obrigatória.");
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      if (resourceId) {
        if (allowedResourceIds && !allowedResourceIds.includes(resourceId)) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.organizationId, isActive: true },
          select: { id: true, capacity: true },
        });
        if (!resource) {
          return fail(404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (resource.capacity < partySize) {
          return fail(400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }
        scopeIds = [resource.id];
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: booking.organizationId,
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
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return fail(404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
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
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    if (scopeIds.length === 0) {
      return fail(409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    const bookingEndsAt = new Date(startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const [templates, overrides, blockingBookings, softBlocks, classSessions] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: {
          organizationId: booking.organizationId,
          OR: [
            { scopeType: "ORGANIZATION", scopeId: 0 },
            { scopeType, scopeId: { in: scopeIds } },
          ],
        },
        select: { scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: booking.organizationId,
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
          organizationId: booking.organizationId,
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
          organizationId: booking.organizationId,
          startsAt: { lt: bookingEndsAt },
          endsAt: { gt: startsAt },
          OR: [{ scopeType: "ORGANIZATION" }, { scopeType, scopeId: { in: scopeIds } }],
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
      }),
      prisma.classSession.findMany({
        where: {
          organizationId: booking.organizationId,
          status: "SCHEDULED",
          startsAt: { lt: bookingEndsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true, startsAt: true, endsAt: true, professionalId: true },
      }),
    ]);

    const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const templatesByScope = groupByScope(templates);
    const overridesByScope = groupByScope(overrides);
    const blocks = [...buildBlocks(blockingBookings), ...buildSessionBlocks(classSessions)];

    const slotKey = startsAt.toISOString();
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;
    const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = scopeIds.map((id) => ({ scopeType, scopeId: id }));

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
      return fail(409, "SLOT_UNAVAILABLE", "Horário indisponível.");
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
        assignmentMode === "RESOURCE" ? item.resourceId === scopeIdForConflict : item.professionalId === scopeIdForConflict,
      )
      .map((item) => ({
        type: "BOOKING" as const,
        sourceId: String(item.id),
        startsAt: item.startsAt,
        endsAt: new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000),
      }));
    classSessions.forEach((session) => {
      if (assignmentMode === "RESOURCE") return;
      if (!session.professionalId || session.professionalId !== scopeIdForConflict) return;
      existing.push({
        type: "BOOKING",
        sourceId: `class:${session.id}`,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    });
    softBlocks.forEach((block) => {
      if (block.scopeType === "ORGANIZATION") {
        existing.push({ type: "SOFT_BLOCK", sourceId: String(block.id), startsAt: block.startsAt, endsAt: block.endsAt });
        return;
      }
      if (block.scopeId !== scopeIdForConflict) return;
      existing.push({ type: "SOFT_BLOCK", sourceId: String(block.id), startsAt: block.startsAt, endsAt: block.endsAt });
    });

    const conflictDecision = evaluateCandidate({ candidate, existing });
    if (!conflictDecision.allowed) {
      const conflict = agendaConflictResponse(conflictDecision);
      return fail(409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }

    const { booking: updated } = await updateBooking({
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId: user.id,
      data: {
        startsAt,
        professionalId,
        resourceId,
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
