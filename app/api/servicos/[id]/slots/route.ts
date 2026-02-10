import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { applyAddonTotals, normalizeAddonSelection, resolveServiceAddonSelection } from "@/lib/reservas/serviceAddons";
import { applyPackageBase, parsePackageId, resolveServicePackageSelection } from "@/lib/reservas/servicePackages";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const SLOT_STEP_MINUTES = 15;

function parseDayParam(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
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

function buildSessionBlocks(sessions: Array<{ startsAt: Date; endsAt: Date; professionalId: number | null }>) {
  return sessions.map((session) => ({
    start: session.startsAt,
    end: session.endsAt,
    professionalId: session.professionalId,
    resourceId: null,
  }));
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return jsonWrap({ ok: false, error: "Serviço inválido." }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceKind: service.kind,
    });

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const dayParam = parseDayParam(req.nextUrl.searchParams.get("day"));
    if (!dayParam) {
      return jsonWrap({ ok: false, error: "Dia inválido." }, { status: 400 });
    }
    const todayParts = getDateParts(new Date(), timezone);
    const dayKey = dayParam.year * 12 + (dayParam.month - 1);
    const minKey = todayParts.year * 12 + (todayParts.month - 1);
    const maxKey = minKey + 3;
    if (dayKey < minKey || dayKey > maxKey) {
      return jsonWrap({ ok: false, error: "RANGE_NOT_ALLOWED" }, { status: 400 });
    }
    if (
      dayParam.year === todayParts.year &&
      dayParam.month === todayParts.month &&
      dayParam.day < todayParts.day
    ) {
      return jsonWrap({ ok: true, items: [] });
    }

    const rangeStart = makeUtcDateFromLocal({ ...dayParam, hour: 0, minute: 0 }, timezone);
    const rangeEnd = makeUtcDateFromLocal({ ...dayParam, hour: 23, minute: 59 }, timezone);

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
    const professionalId = parsePositiveInt(req.nextUrl.searchParams.get("professionalId"));
    const partySize = parsePositiveInt(req.nextUrl.searchParams.get("partySize"));
    const durationOverride = parsePositiveInt(req.nextUrl.searchParams.get("durationMinutes"));
    const addonSelection = normalizeAddonSelection(req.nextUrl.searchParams.get("addons"));
    const packageIdRaw = req.nextUrl.searchParams.get("packageId");
    const packageId = parsePackageId(packageIdRaw);
    if (packageIdRaw && !packageId) {
      return jsonWrap({ ok: false, error: "Pacote inválido." }, { status: 400 });
    }

    if (!assignmentConfig.isCourtService && partySize) {
      return jsonWrap(getResourceModeBlockedPayload(), { status: 409 });
    }

    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (!partySize) {
        return jsonWrap({ ok: false, error: "Capacidade obrigatória." }, { status: 400 });
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return jsonWrap({ ok: true, items: [] });
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
        return jsonWrap({ ok: true, items: [] });
      }
    } else {
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return jsonWrap({ ok: true, items: [] });
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
      return jsonWrap({ ok: true, items: [] });
    }

    const shouldUseOrgOnly = false;
    const now = new Date();
    let effectiveDurationMinutes = service.durationMinutes;
    let effectivePriceCents = service.unitPriceCents ?? 0;
    let baseDurationMinutes = service.durationMinutes;
    let basePriceCents = service.unitPriceCents ?? 0;
    if (packageId) {
      const packageResolution = await resolveServicePackageSelection({
        tx: prisma,
        serviceId: service.id,
        packageId,
      });
      if (!packageResolution.ok) {
        return jsonWrap({ ok: false, error: packageResolution.error }, { status: 400 });
      }
      const base = applyPackageBase({
        baseDurationMinutes: service.durationMinutes,
        basePriceCents: service.unitPriceCents ?? 0,
        pkg: packageResolution.package,
      });
      baseDurationMinutes = base.durationMinutes;
      basePriceCents = base.priceCents;
    }
    if (addonSelection.length > 0) {
      const addonResolution = await resolveServiceAddonSelection({
        tx: prisma,
        serviceId: service.id,
        selection: addonSelection,
      });
      if (!addonResolution.ok) {
        return jsonWrap({ ok: false, error: addonResolution.error }, { status: 400 });
      }
      const totals = applyAddonTotals({
        baseDurationMinutes,
        basePriceCents,
        totalDeltaMinutes: addonResolution.totalDeltaMinutes,
        totalDeltaPriceCents: addonResolution.totalDeltaPriceCents,
      });
      effectiveDurationMinutes = totals.durationMinutes;
      effectivePriceCents = totals.priceCents;
    } else {
      effectiveDurationMinutes = baseDurationMinutes;
      effectivePriceCents = basePriceCents;
    }
    if (durationOverride) {
      effectiveDurationMinutes = durationOverride;
    }

    if (effectivePriceCents > 0) {
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
        return jsonWrap(
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
    const [templates, overrides, bookings, classSessions] = await Promise.all([
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
          date: new Date(Date.UTC(dayParam.year, dayParam.month - 1, dayParam.day)),
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
      prisma.classSession.findMany({
        where: {
          organizationId: service.organizationId,
          status: "SCHEDULED",
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
        select: { startsAt: true, endsAt: true, professionalId: true },
      }),
    ]);

    const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const templatesByScope = groupByScope(templates);
    const overridesByScope = groupByScope(overrides);
    const blocks = [...buildBlocks(bookings), ...buildSessionBlocks(classSessions)];

    const slotMap = new Map<string, { startsAt: Date; durationMinutes: number }>();
    const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = shouldUseOrgOnly
      ? [{ scopeType: "ORGANIZATION", scopeId: 0 }]
      : scopeIds.map((id) => ({ scopeType, scopeId: id }));

    scopesToCheck.forEach((scope) => {
      const slots = getAvailableSlotsForScope({
        rangeStart,
        rangeEnd,
        timezone,
        durationMinutes: effectiveDurationMinutes,
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

    return jsonWrap({ ok: true, items });
  } catch (err) {
    console.error("GET /api/servicos/[id]/slots error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar horários." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
