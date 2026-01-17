import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";

const SLOT_STEP_MINUTES = 15;

function parseMonthParam(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function buildDateKey(parts: { year: number; month: number; day: number }) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function buildMonthRange(params: { year: number; month: number; timezone: string }) {
  const start = makeUtcDateFromLocal(
    { year: params.year, month: params.month, day: 1, hour: 0, minute: 0 },
    params.timezone,
  );
  const lastDay = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
  const end = makeUtcDateFromLocal(
    { year: params.year, month: params.month, day: lastDay, hour: 23, minute: 59 },
    params.timezone,
  );
  return { start, end, lastDay };
}

function buildBlocks(bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>) {
  return bookings.map((booking) => ({
    start: booking.startsAt,
    end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
  }));
}

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
        professionalLinks: {
          select: { professionalId: true, professional: { select: { isActive: true } } },
        },
        resourceLinks: {
          select: { resourceId: true, resource: { select: { isActive: true } } },
        },
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
    const monthParam = parseMonthParam(req.nextUrl.searchParams.get("month"));
    const todayParts = getDateParts(new Date(), timezone);
    const targetMonth = monthParam ?? { year: todayParts.year, month: todayParts.month };
    const { start, end, lastDay } = buildMonthRange({ ...targetMonth, timezone });

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
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        const days = Array.from({ length: lastDay }, (_, idx) => {
          const day = idx + 1;
          const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
          return { date: key, hasAvailability: false, slots: 0 };
        });
        return NextResponse.json({
          ok: true,
          timezone,
          month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
          days,
        });
      }
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
        const days = Array.from({ length: lastDay }, (_, idx) => {
          const day = idx + 1;
          const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
          return { date: key, hasAvailability: false, slots: 0 };
        });
        return NextResponse.json({
          ok: true,
          timezone,
          month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
          days,
        });
      }
    } else {
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return NextResponse.json({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          const days = Array.from({ length: lastDay }, (_, idx) => {
            const day = idx + 1;
            const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
            return { date: key, hasAvailability: false, slots: 0 };
          });
          return NextResponse.json({
            ok: true,
            timezone,
            month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
            days,
          });
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
      const days = Array.from({ length: lastDay }, (_, idx) => {
        const day = idx + 1;
        const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
        return { date: key, hasAvailability: false, slots: 0 };
      });
      return NextResponse.json({
        ok: true,
        timezone,
        month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
        days,
      });
    }

    const shouldUseOrgOnly = false;
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
            gte: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
            lte: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())),
          },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: end, gte: new Date(start.getTime() - 24 * 60 * 60 * 1000) },
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

    const slotMap = new Map<string, number>();
    const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = shouldUseOrgOnly
      ? [{ scopeType: "ORGANIZATION", scopeId: 0 }]
      : scopeIds.map((id) => ({ scopeType, scopeId: id }));

    scopesToCheck.forEach((scope) => {
      const slots = getAvailableSlotsForScope({
        rangeStart: start,
        rangeEnd: end,
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
        const parts = getDateParts(slot.startsAt, timezone);
        const key = buildDateKey(parts);
        slotMap.set(key, (slotMap.get(key) ?? 0) + 1);
      });
    });

    const days = Array.from({ length: lastDay }, (_, idx) => {
      const day = idx + 1;
      const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
      return { date: key, hasAvailability: slotMap.has(key), slots: slotMap.get(key) ?? 0 };
    });

    return NextResponse.json({
      ok: true,
      timezone,
      month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
      days,
    });
  } catch (err) {
    console.error("GET /api/servicos/[id]/calendario error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar calendário." }, { status: 500 });
  }
}
