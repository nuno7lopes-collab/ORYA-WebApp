import { NextRequest, NextResponse } from "next/server";
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

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt.trim() : "";
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
    }
    if (
      membership.role === OrganizationMemberRole.STAFF &&
      (!booking.professional?.userId || booking.professional.userId !== profile.id)
    ) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(booking.status)) {
      return NextResponse.json({ ok: false, error: "Reserva já encerrada." }, { status: 409 });
    }

    const timezone = booking.service.organization?.timezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return NextResponse.json({ ok: false, error: "Horário fora da grelha de 15 minutos." }, { status: 400 });
    }

    if (startsAt <= new Date()) {
      return NextResponse.json({ ok: false, error: "Este horário já passou." }, { status: 400 });
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: booking.service.organization?.reservationAssignmentMode ?? null,
      serviceKind: booking.service.kind ?? null,
    });
    const assignmentMode = booking.assignmentMode ?? assignmentConfig.mode;
    if (!assignmentConfig.isCourtService && assignmentMode === "RESOURCE") {
      return NextResponse.json(getResourceModeBlockedPayload(), { status: 409 });
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
    let partySize: number | null = booking.partySize ?? null;
    let scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (!partySize) {
        return NextResponse.json({ ok: false, error: "Capacidade obrigatória." }, { status: 400 });
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return NextResponse.json({ ok: false, error: "Sem recursos disponíveis para este serviço." }, { status: 409 });
      }
      if (resourceId) {
        if (allowedResourceIds && !allowedResourceIds.includes(resourceId)) {
          return NextResponse.json({ ok: false, error: "Recurso inválido." }, { status: 404 });
        }
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true, capacity: true },
        });
        if (!resource) {
          return NextResponse.json({ ok: false, error: "Recurso inválido." }, { status: 404 });
        }
        if (resource.capacity < partySize) {
          return NextResponse.json({ ok: false, error: "Capacidade acima do recurso." }, { status: 400 });
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
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: booking.service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return NextResponse.json({ ok: false, error: "Sem profissionais disponíveis para este serviço." }, { status: 409 });
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
      return NextResponse.json({ ok: false, error: "Sem disponibilidade para este serviço." }, { status: 409 });
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    const [templates, overrides, blockingBookings] = await Promise.all([
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
          startsAt: { lt: new Date(startsAt.getTime() + booking.durationMinutes * 60 * 1000) },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: new Date() } },
          ],
        },
        select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
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
      return NextResponse.json({ ok: false, error: "Horário indisponível." }, { status: 409 });
    }

    if (assignmentMode === "RESOURCE" && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (assignmentMode === "PROFESSIONAL" && assignedScopeId) {
      professionalId = assignedScopeId;
    }

    const { ip, userAgent } = getRequestMeta(req);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
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

    return NextResponse.json({ ok: true, booking: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/[id]/reschedule error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao reagendar reserva." }, { status: 500 });
  }
}
