export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";

const PENDING_HOLD_MINUTES = 10;
const MAX_PENDING_PER_USER = 3;
const SLOT_STEP_MINUTES = 15;

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
  const map = new Map(parts.map((p) => [p.type, p.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildBlocks(bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>) {
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
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { contactPhone: true },
    });
    if (!profile?.contactPhone) {
      return NextResponse.json(
        { ok: false, error: "PHONE_REQUIRED", message: "Telemóvel obrigatório para reservar." },
        { status: 400 },
      );
    }
    const payload = await req.json().catch(() => ({}));
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : null;
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const locationTextInputRaw = typeof payload?.locationText === "string" ? payload.locationText.trim() : "";
    const locationTextInput = locationTextInputRaw ? locationTextInputRaw.slice(0, 160) : "";

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Horário inválido." }, { status: 400 });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        kind: true,
        organizationId: true,
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
          select: {
            timezone: true,
            address: true,
            reservationAssignmentMode: true,
            orgType: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceKind: service.kind,
    });

    if (service.unitPriceCents > 0) {
      const isPlatformOrg = service.organization?.orgType === "PLATFORM";
      const gate = getPaidSalesGate({
        officialEmail: service.organization?.officialEmail ?? null,
        officialEmailVerifiedAt: service.organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: service.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: service.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: service.organization?.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "PAYMENTS_NOT_READY",
            message: formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 409 },
        );
      }
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

    const pendingCount = await prisma.booking.count({
      where: {
        userId: user.id,
        status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
        pendingExpiresAt: { gt: now },
      },
    });
    if (pendingCount >= MAX_PENDING_PER_USER) {
      return NextResponse.json({ ok: false, error: "Demasiadas pré-reservas ativas." }, { status: 429 });
    }

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
    const professionalIdRaw = parsePositiveInt(payload?.professionalId);
    const partySizeRaw = parsePositiveInt(payload?.partySize);
    let professionalId: number | null = null;
    let partySize: number | null = null;
    let scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (!assignmentConfig.isCourtService && partySizeRaw) {
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
    } else {
      if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return NextResponse.json({ ok: false, error: "Profissional indisponível." }, { status: 404 });
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

    if (scopeIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Sem disponibilidade para este serviço." }, { status: 409 });
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

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
    const scopesToCheck = shouldUseOrgOnly ? [{ scopeType: "ORGANIZATION" as const, scopeId: 0 }] : scopeIds.map((id) => ({ scopeType, scopeId: id }));
    const slotIsAvailable = scopesToCheck.some((scope) => {
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
      return slots.some((slot) => slot.startsAt.toISOString() === slotKey);
    });

    if (!slotIsAvailable) {
      return NextResponse.json({ ok: false, error: "Horário indisponível." }, { status: 409 });
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
        userId: user.id,
        startsAt,
        durationMinutes: service.durationMinutes,
        price: service.unitPriceCents,
        currency: service.currency,
        status: "PENDING_CONFIRMATION",
        assignmentMode,
        professionalId,
        partySize,
        pendingExpiresAt,
        snapshotTimezone: timezone,
        locationMode: service.locationMode,
        locationText,
      },
      select: { id: true, status: true, pendingExpiresAt: true },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: service.organizationId,
      actorUserId: user.id,
      action: "BOOKING_PENDING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/reservar error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao reservar." }, { status: 500 });
  }
}
