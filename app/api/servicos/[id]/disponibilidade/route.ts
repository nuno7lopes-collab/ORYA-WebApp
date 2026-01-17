import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";

const LOOKAHEAD_DAYS = 21;
const SLOT_STEP_MINUTES = 15;

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

function buildRange(dateParam: string | null, dayParam: string | null, timezone: string) {
  const now = new Date();
  const todayParts = getDateParts(now, timezone);
  const todayStart = makeUtcDateFromLocal(
    { ...todayParts, hour: 0, minute: 0 },
    timezone,
  );
  const todayEnd = makeUtcDateFromLocal(
    { ...todayParts, hour: 23, minute: 59 },
    timezone,
  );

  if (dateParam === "today") {
    return { start: todayStart, end: todayEnd };
  }

  if (dateParam === "weekend") {
    const dayOfWeek = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day)).getUTCDay();
    const daysToSaturday = (6 - dayOfWeek + 7) % 7;
    const weekendParts = addDays(todayParts, daysToSaturday);
    const start = makeUtcDateFromLocal({ ...weekendParts, hour: 0, minute: 0 }, timezone);
    const end = makeUtcDateFromLocal({ ...weekendParts, hour: 23, minute: 59 }, timezone);
    return { start, end };
  }

  if (dateParam === "day" && dayParam) {
    const match = dayParam.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        const start = makeUtcDateFromLocal({ year, month, day, hour: 0, minute: 0 }, timezone);
        const end = makeUtcDateFromLocal({ year, month, day, hour: 23, minute: 59 }, timezone);
        return { start, end };
      }
    }
  }

  const endParts = addDays(todayParts, LOOKAHEAD_DAYS);
  const end = makeUtcDateFromLocal({ ...endParts, hour: 23, minute: 59 }, timezone);
  return { start: now, end };
}

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
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
        durationMinutes: true,
        organizationId: true,
        unitPriceCents: true,
        organization: {
          select: {
            timezone: true,
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
    const dateParam = req.nextUrl.searchParams.get("date");
    const dayParam = req.nextUrl.searchParams.get("day");
    const range = buildRange(dateParam, dayParam, timezone);
    const rangeStart = range.start;
    const rangeEnd = range.end;

    const assignmentMode = assignmentConfig.mode;
    const professionalId = parsePositiveInt(req.nextUrl.searchParams.get("professionalId"));
    const partySize = parsePositiveInt(req.nextUrl.searchParams.get("partySize"));

    if (!assignmentConfig.isCourtService && partySize) {
      return NextResponse.json(getResourceModeBlockedPayload(), { status: 409 });
    }
    let scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (!partySize) {
        return NextResponse.json({ ok: false, error: "Capacidade obrigatória." }, { status: 400 });
      }
      const resources = await prisma.reservationResource.findMany({
        where: { organizationId: service.organizationId, isActive: true, capacity: { gte: partySize } },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      scopeIds = resources.map((resource) => resource.id);
      if (scopeIds.length === 0) {
        return NextResponse.json({ ok: true, items: [] });
      }
    } else {
      if (professionalId) {
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        scopeIds = [professional.id];
      } else {
        const professionals = await prisma.reservationProfessional.findMany({
          where: { organizationId: service.organizationId, isActive: true },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    const shouldUseOrgOnly = scopeIds.length === 0;
    const now = new Date();
    const [templates, overrides, bookings] = await Promise.all([
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
          date: {
            gte: new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate())),
            lte: new Date(Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate())),
          },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: rangeEnd, gte: new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000) },
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
    const blocks = buildBlocks(bookings);

    const slotMap = new Map<string, { startsAt: Date; durationMinutes: number }>();
    const scopesToCheck = shouldUseOrgOnly ? [{ scopeType: "ORGANIZATION" as const, scopeId: 0 }] : scopeIds.map((id) => ({ scopeType, scopeId: id }));

    scopesToCheck.forEach((scope) => {
      const slots = getAvailableSlotsForScope({
        rangeStart,
        rangeEnd,
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
      slots.forEach((slot) => {
        slotMap.set(slot.startsAt.toISOString(), { startsAt: slot.startsAt, durationMinutes: slot.durationMinutes });
      });
    });

    const items = Array.from(slotMap.values())
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((slot) => ({
        slotKey: slot.startsAt.toISOString(),
        startsAt: slot.startsAt.toISOString(),
        durationMinutes: slot.durationMinutes,
        status: "OPEN",
      }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/servicos/[id]/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar horários." }, { status: 500 });
  }
}
