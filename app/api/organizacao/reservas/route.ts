import { NextRequest, NextResponse } from "next/server";
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

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const PENDING_HOLD_MINUTES = 10;
const SLOT_STEP_MINUTES = 15;

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

export async function GET(req: NextRequest) {
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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
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
        return NextResponse.json({ ok: true, items: [] });
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
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/reservas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar reservas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
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

    const isStaff = membership.role === OrganizationMemberRole.STAFF;
    const staffProfessional = isStaff
      ? await prisma.reservationProfessional.findFirst({
          where: { organizationId: organization.id, userId: profile.id, isActive: true },
          select: { id: true },
        })
      : null;
    if (isStaff && !staffProfessional) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
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
      return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
    }
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Horário inválido." }, { status: 400 });
    }

    const clientProfile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, contactPhone: true },
    });
    if (!clientProfile) {
      return NextResponse.json({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    }
    if (!clientProfile.contactPhone) {
      return NextResponse.json({ ok: false, error: "PHONE_REQUIRED" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return NextResponse.json({ ok: false, error: "Horário fora da grelha de 15 minutos." }, { status: 400 });
    }

    const now = new Date();
    if (startsAt <= now) {
      return NextResponse.json({ ok: false, error: "Este horário já passou." }, { status: 400 });
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
    let scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (!assignmentConfig.isCourtService && (partySizeRaw || resourceIdRaw)) {
      return NextResponse.json(getResourceModeBlockedPayload(), { status: 409 });
    }

    if (assignmentMode === "RESOURCE") {
      if (!partySizeRaw) {
        return NextResponse.json({ ok: false, error: "Capacidade obrigatória." }, { status: 400 });
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return NextResponse.json({ ok: false, error: "Sem recursos disponíveis para este serviço." }, { status: 409 });
      }
      partySize = partySizeRaw;
      if (resourceIdRaw) {
        if (allowedResourceIds && !allowedResourceIds.includes(resourceIdRaw)) {
          return NextResponse.json({ ok: false, error: "Recurso inválido." }, { status: 404 });
        }
        const resource = await prisma.reservationResource.findFirst({
          where: { id: resourceIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true, capacity: true },
        });
        if (!resource) {
          return NextResponse.json({ ok: false, error: "Recurso inválido." }, { status: 404 });
        }
        if (resource.capacity < partySize) {
          return NextResponse.json({ ok: false, error: "Capacidade acima do recurso." }, { status: 400 });
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
          return NextResponse.json({ ok: false, error: "Sem recursos disponíveis para esta capacidade." }, { status: 409 });
        }
      }
    } else {
      if (isStaff && staffProfessional) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(staffProfessional.id)) {
          return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
        }
        if (professionalIdRaw && professionalIdRaw !== staffProfessional.id) {
          return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
        }
        professionalId = staffProfessional.id;
        scopeIds = [staffProfessional.id];
      } else if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        professionalId = professional.id;
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return NextResponse.json({ ok: false, error: "Sem profissionais disponíveis para este serviço." }, { status: 409 });
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
      return NextResponse.json({ ok: false, error: "Sem profissionais configurados." }, { status: 409 });
    }

    if (assignmentMode === "RESOURCE" && scopeIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Sem recursos configurados." }, { status: 409 });
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    if (scopeIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Sem disponibilidade para este serviço." }, { status: 409 });
    }

    const shouldUseOrgOnly = false;
    const [templates, overrides, blockingBookings] = await Promise.all([
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
          startsAt: { lt: new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000) },
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
      return NextResponse.json({ ok: false, error: "Horário indisponível." }, { status: 409 });
    }

    if (assignmentMode === "RESOURCE" && !resourceId && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (assignmentMode === "PROFESSIONAL" && !professionalId && assignedScopeId) {
      professionalId = assignedScopeId;
    }

    const pendingExpiresAt = new Date(now.getTime() + PENDING_HOLD_MINUTES * 60 * 1000);
    const locationText =
      service.locationMode === "CHOOSE_AT_BOOKING"
        ? locationTextInput || null
        : service.defaultLocationText ?? service.organization?.address ?? null;
    if (service.locationMode === "CHOOSE_AT_BOOKING" && !locationText) {
      return NextResponse.json({ ok: false, error: "Local obrigatório para esta marcação." }, { status: 400 });
    }

    const booking = await prisma.booking.create({
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

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar reserva." }, { status: 500 });
  }
}
