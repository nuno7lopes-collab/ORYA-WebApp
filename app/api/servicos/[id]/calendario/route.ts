import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedSchedule, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { buildHybridSlotMatrix } from "@/lib/reservas/hybridAssignment";
import {
  resolveServicePartySizeRules,
  validateRequestedPartySize,
} from "@/lib/reservas/servicePartySize";
import { applyAddonTotals, normalizeAddonSelection, resolveServiceAddonSelection } from "@/lib/reservas/serviceAddons";
import { applyPackageBase, parsePackageId, resolveServicePackageSelection } from "@/lib/reservas/servicePackages";
import {
  BOOKING_DURATION_CATALOG,
  getOrganizationBookingPolicy,
  validateDurationAgainstPolicy,
} from "@/lib/reservas/gridPolicy";
import { resolveCourtDurationPrice } from "@/lib/reservas/serviceDurationPrices";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveAllowedServiceScopeIds } from "@/lib/reservas/serviceScopes";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseMonthParam(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

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

function buildDateKey(parts: { year: number; month: number; day: number }) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function getLocalDateKey(value: Date, timezone: string) {
  const parts = getDateParts(value, timezone);
  return buildDateKey(parts);
}

function isAlignedToGrid(startsAt: Date, timezone: string, gridMinutes: number) {
  if (!Number.isFinite(gridMinutes) || gridMinutes <= 0) return true;
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(startsAt);
  const map = new Map(timeParts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const totalMinutes = hour * 60 + minute;
  return totalMinutes % gridMinutes === 0;
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

function buildSessionBlocks(sessions: Array<{ startsAt: Date; endsAt: Date; professionalId: number | null }>) {
  return sessions.map((session) => ({
    start: session.startsAt,
    end: session.endsAt,
    professionalId: session.professionalId,
    resourceId: null,
  }));
}

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSelectionRulesPayload(params: {
  partySizeRequired: boolean;
  partySizeMin: number;
  partySizeMax: number;
  partySizeStep: number;
  requiresProfessional: boolean;
  requiresResource: boolean;
}) {
  return {
    partySizeRequired: params.partySizeRequired,
    partySizeRange: {
      min: params.partySizeMin,
      max: params.partySizeMax,
      step: params.partySizeStep,
    },
    partySizeMin: params.partySizeMin,
    partySizeMax: params.partySizeMax,
    partySizeStep: params.partySizeStep,
    requiresProfessional: params.requiresProfessional,
    requiresResource: params.requiresResource,
  };
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
        title: true,
        coverImageUrl: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
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
            primaryModule: true,
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

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const todayPartsForRange = getDateParts(new Date(), timezone);
    const minMonthKey = (todayPartsForRange.year * 12) + (todayPartsForRange.month - 1);
    const maxMonthKey = minMonthKey + 3;

    const dayParamForRange = parseDayParam(req.nextUrl.searchParams.get("day"));
    if (dayParamForRange) {
      const dayKey = (dayParamForRange.year * 12) + (dayParamForRange.month - 1);
      if (dayKey < minMonthKey || dayKey > maxMonthKey) {
        return jsonWrap({ ok: false, error: "RANGE_NOT_ALLOWED" }, { status: 400 });
      }
    } else {
      const monthParamForRange = parseMonthParam(req.nextUrl.searchParams.get("month"));
      const targetMonthForRange = monthParamForRange ?? {
        year: todayPartsForRange.year,
        month: todayPartsForRange.month,
      };
      const monthKey = (targetMonthForRange.year * 12) + (targetMonthForRange.month - 1);
      if (monthKey < minMonthKey || monthKey > maxMonthKey) {
        return jsonWrap({ ok: false, error: "RANGE_NOT_ALLOWED" }, { status: 400 });
      }
    }

    const reservasAccess = await ensureReservasModuleAccess(
      {
        id: service.organizationId,
        primaryModule: service.organization?.primaryModule ?? null,
      },
      prisma,
    );
    if (!reservasAccess.ok) {
      return jsonWrap(
        { ok: false, error: reservasAccess.errorCode ?? "RESERVAS_UNAVAILABLE", message: reservasAccess.error },
        { status: 403 },
      );
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const availabilityMode = assignmentConfig.availabilityMode;
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: assignmentConfig.assignmentMode,
      serviceKind: service.kind ?? null,
      partySizeRequired: service.partySizeRequired,
      partySizeMin: service.partySizeMin,
      partySizeMax: service.partySizeMax,
      partySizeStep: service.partySizeStep,
    });
    const selectionRules = buildSelectionRulesPayload({
      ...partySizeRules,
      requiresProfessional: assignmentConfig.requiresProfessional,
      requiresResource: assignmentConfig.requiresResource,
    });
    const bookingPolicy = await getOrganizationBookingPolicy({
      organizationId: service.organizationId,
      tx: prisma,
    });
    const bookingPolicyPayload = {
      gridMinutes: bookingPolicy.gridMinutes,
      durationCatalog: [...BOOKING_DURATION_CATALOG],
      activeDurations: bookingPolicy.allowedDurations,
      allowedDurations: bookingPolicy.allowedDurations,
      allowCustomDuration: false,
      presetDurations: bookingPolicy.allowedDurations,
    };

    if (service.kind === "CLASS") {
      const dayParam = parseDayParam(req.nextUrl.searchParams.get("day"));
      const monthParam = parseMonthParam(req.nextUrl.searchParams.get("month"));
      const requestedTrainerId = parsePositiveInt(req.nextUrl.searchParams.get("professionalId"));
      const requestedCourtId = parsePositiveInt(req.nextUrl.searchParams.get("courtId"));
      const now = new Date();

      if (req.nextUrl.searchParams.get("professionalId") != null && !requestedTrainerId) {
        return jsonWrap({ ok: false, error: "INVALID_PROFESSIONAL" }, { status: 400 });
      }
      if (req.nextUrl.searchParams.get("courtId") != null && !requestedCourtId) {
        return jsonWrap({ ok: false, error: "INVALID_COURT" }, { status: 400 });
      }

      const sessionWhereBase = {
        organizationId: service.organizationId,
        serviceId: service.id,
        ...(requestedTrainerId ? { professionalId: requestedTrainerId } : {}),
        ...(requestedCourtId ? { courtId: requestedCourtId } : {}),
      };

      const sessionSelect = {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        professionalId: true,
        courtId: true,
        professional: {
          select: {
            id: true,
            name: true,
            user: { select: { avatarUrl: true, username: true, fullName: true } },
          },
        },
        court: { select: { id: true, name: true, isActive: true } },
      } as const;

      if (dayParam) {
        const dayStart = makeUtcDateFromLocal({ ...dayParam, hour: 0, minute: 0 }, timezone);
        const dayEnd = makeUtcDateFromLocal({ ...dayParam, hour: 23, minute: 59 }, timezone);

        const sessions = await prisma.classSession.findMany({
          where: {
            ...sessionWhereBase,
            startsAt: { gte: dayStart, lte: dayEnd, gt: now },
          },
          orderBy: [{ startsAt: "asc" }],
          select: sessionSelect,
        });

        const enrollmentRows = sessions.length
          ? await prisma.academyEnrollment.groupBy({
              by: ["classSessionId"],
              where: {
                organizationId: service.organizationId,
                classSessionId: { in: sessions.map((session) => session.id) },
                status: { in: ["PENDING", "CONFIRMED"] },
              },
              _count: { _all: true },
            })
          : [];
        const enrolledCountBySession = new Map<number, number>();
        enrollmentRows.forEach((row) => enrolledCountBySession.set(row.classSessionId, row._count._all));

        const items = sessions.map((session) => {
          const enrolledCount = enrolledCountBySession.get(session.id) ?? 0;
          const isFull = session.status !== "SCHEDULED" || enrolledCount >= session.capacity;
          return {
            slotKey: `class-session:${session.id}`,
            sessionId: session.id,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            durationMinutes: Math.max(
              30,
              Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000),
            ),
            status: session.status !== "SCHEDULED" ? "CANCELLED" : isFull ? "FULL" : "AVAILABLE",
            capacity: session.capacity,
            enrolledCount,
            isFull,
            trainer: session.professional
              ? {
                  id: session.professional.id,
                  name: session.professional.name,
                  avatarUrl: session.professional.user?.avatarUrl ?? null,
                  username: session.professional.user?.username ?? null,
                  fullName: session.professional.user?.fullName ?? null,
                }
              : null,
            court: session.court
              ? {
                  id: session.court.id,
                  name: session.court.name ?? "Campo",
                  isActive: session.court.isActive ?? true,
                }
              : null,
            class: {
              id: service.id,
              title: service.title,
              coverImageUrl: service.coverImageUrl ?? null,
            },
          };
        });

        return jsonWrap({
          ok: true,
          timezone,
          serviceId: service.id,
          month: `${dayParam.year}-${String(dayParam.month).padStart(2, "0")}`,
          items,
          selectionRules,
          bookingPolicy: bookingPolicyPayload,
        });
      }

      const targetMonth = monthParam ?? {
        year: todayPartsForRange.year,
        month: todayPartsForRange.month,
      };
      const monthRange = buildMonthRange({
        year: targetMonth.year,
        month: targetMonth.month,
        timezone,
      });

      const sessions = await prisma.classSession.findMany({
        where: {
          ...sessionWhereBase,
          startsAt: { gte: monthRange.start, lte: monthRange.end, gt: now },
        },
        orderBy: [{ startsAt: "asc" }],
        select: {
          id: true,
          startsAt: true,
          capacity: true,
          status: true,
        },
      });

      const enrollmentRows = sessions.length
        ? await prisma.academyEnrollment.groupBy({
            by: ["classSessionId"],
            where: {
              organizationId: service.organizationId,
              classSessionId: { in: sessions.map((session) => session.id) },
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            _count: { _all: true },
          })
        : [];
      const enrolledCountBySession = new Map<number, number>();
      enrollmentRows.forEach((row) => enrolledCountBySession.set(row.classSessionId, row._count._all));

      const slotsByDate = new Map<string, number>();
      for (const session of sessions) {
        const enrolledCount = enrolledCountBySession.get(session.id) ?? 0;
        const isAvailable = session.status === "SCHEDULED" && enrolledCount < session.capacity;
        if (!isAvailable) continue;
        const key = getLocalDateKey(session.startsAt, timezone);
        slotsByDate.set(key, (slotsByDate.get(key) ?? 0) + 1);
      }

      const days = Array.from({ length: monthRange.lastDay }, (_, index) => {
        const key = buildDateKey({
          year: targetMonth.year,
          month: targetMonth.month,
          day: index + 1,
        });
        const slots = slotsByDate.get(key) ?? 0;
        return { date: key, hasAvailability: slots > 0, slots };
      });

      return jsonWrap({
        ok: true,
        timezone,
        serviceId: service.id,
        month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
        days,
        selectionRules,
        bookingPolicy: bookingPolicyPayload,
      });
    }

    const { allowedProfessionalIds, allowedResourceIds } = resolveAllowedServiceScopeIds({
      professionalLinks: service.professionalLinks,
      resourceLinks: service.resourceLinks,
    });
    const courtIdParam = req.nextUrl.searchParams.get("courtId");
    const requestedCourtId = parsePositiveInt(courtIdParam);
    if (courtIdParam != null && !requestedCourtId) {
      return jsonWrap({ ok: false, error: "INVALID_COURT" }, { status: 400 });
    }
    if (requestedCourtId && !assignmentConfig.isCourtService) {
      return jsonWrap({ ok: false, error: "INVALID_COURT" }, { status: 400 });
    }
    const dayParam = parseDayParam(req.nextUrl.searchParams.get("day"));
    if (dayParam) {
      const todayParts = getDateParts(new Date(), timezone);
      const dayKey = (dayParam.year * 12) + (dayParam.month - 1);
      const minKey = (todayParts.year * 12) + (todayParts.month - 1);
      const maxKey = minKey + 3;
      if (dayKey < minKey || dayKey > maxKey) {
        return jsonWrap({ ok: false, error: "RANGE_NOT_ALLOWED" }, { status: 400 });
      }
      if (
        dayParam.year === todayParts.year &&
        dayParam.month === todayParts.month &&
        dayParam.day < todayParts.day
      ) {
        return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
      }

      const rangeStart = makeUtcDateFromLocal({ ...dayParam, hour: 0, minute: 0 }, timezone);
      const rangeEnd = makeUtcDateFromLocal({ ...dayParam, hour: 23, minute: 59 }, timezone);
      const professionalId = parsePositiveInt(req.nextUrl.searchParams.get("professionalId"));
      const partySizeRaw = parsePositiveInt(req.nextUrl.searchParams.get("partySize"));
      const partySizeValidation = validateRequestedPartySize({
        requested: partySizeRaw,
        rules: partySizeRules,
      });
      if (!partySizeValidation.ok) {
        return jsonWrap(
          { ok: false, error: partySizeValidation.errorCode, message: partySizeValidation.message },
          { status: 400 },
        );
      }
      const partySize = partySizeValidation.partySize;
      const durationOverride = parsePositiveInt(req.nextUrl.searchParams.get("durationMinutes"));
      const addonSelection = normalizeAddonSelection(req.nextUrl.searchParams.get("addons"));
      const packageIdRaw = req.nextUrl.searchParams.get("packageId");
      const packageId = parsePackageId(packageIdRaw);
      if (packageIdRaw && !packageId) {
        return jsonWrap({ ok: false, error: "Pacote inválido." }, { status: 400 });
      }

      const now = new Date();
      const isCourtService = service.kind === "COURT";
      let effectiveDurationMinutes = service.durationMinutes;
      let effectivePriceCents = service.unitPriceCents ?? 0;
      let baseDurationMinutes = service.durationMinutes;
      let basePriceCents = service.unitPriceCents ?? 0;
      if (packageId && !isCourtService) {
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
      const durationValidation = validateDurationAgainstPolicy({
        durationMinutes: effectiveDurationMinutes,
        policy: bookingPolicy,
      });
      if (!durationValidation.ok) {
        return jsonWrap(
          { ok: false, error: durationValidation.errorCode, message: durationValidation.message },
          { status: 400 },
        );
      }
      if (isCourtService) {
        const courtDurationPrice = await resolveCourtDurationPrice({
          tx: prisma,
          serviceId: service.id,
          durationMinutes: effectiveDurationMinutes,
        });
        if (!courtDurationPrice) {
          return jsonWrap(
            { ok: false, error: "DURATION_NOT_PRICED", message: "Duração sem preço configurado." },
            { status: 400 },
          );
        }
        effectivePriceCents = Math.max(0, courtDurationPrice.priceCents + Math.max(0, effectivePriceCents - basePriceCents));
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

      if (availabilityMode === "HYBRID") {
        let professionals: Array<{ id: number; priority: number }> = [];
        if (professionalId) {
          if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
            return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
          }
          const professional = await prisma.reservationProfessional.findFirst({
            where: { id: professionalId, organizationId: service.organizationId, isActive: true },
            select: { id: true, priority: true },
          });
          if (!professional) {
            return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
          }
          professionals = [professional];
        } else {
          if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
            return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
          }
          professionals = await prisma.reservationProfessional.findMany({
            where: {
              organizationId: service.organizationId,
              isActive: true,
              ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
            },
            orderBy: [{ priority: "asc" }, { id: "asc" }],
            select: { id: true, priority: true },
          });
        }
        if (professionals.length === 0) {
          return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
        }

        if (allowedResourceIds && allowedResourceIds.length === 0) {
          return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
        }
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(requestedCourtId ? { courtId: requestedCourtId } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (resources.length === 0) {
          return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
        }

        const professionalIds = professionals.map((item) => item.id);
        const resourceIds = resources.map((item) => item.id);

        const scopeFilters = [
          { scopeType: "ORGANIZATION" as const, scopeId: 0 },
          { scopeType: "PROFESSIONAL" as const, scopeId: { in: professionalIds } },
          { scopeType: "RESOURCE" as const, scopeId: { in: resourceIds } },
        ];
        const [schedules, overrides, bookings, classSessions] = await Promise.all([
          prisma.availabilitySchedule.findMany({
            where: {
              organizationId: service.organizationId,
              OR: scopeFilters,
            },
            select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
          }),
          prisma.availabilityOverride.findMany({
            where: {
              organizationId: service.organizationId,
              OR: scopeFilters,
              date: new Date(Date.UTC(dayParam.year, dayParam.month - 1, dayParam.day)),
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
            select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
          }),
          prisma.booking.findMany({
            where: {
              organizationId: service.organizationId,
              startsAt: { lt: rangeEnd, gte: new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000) },
              AND: [
                {
                  OR: [
                    { professionalId: { in: professionalIds } },
                    { resourceId: { in: resourceIds } },
                  ],
                },
                {
                  OR: [
                    { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
                    {
                      status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
                      pendingExpiresAt: { gt: now },
                      startsAt: { gt: now },
                    },
                  ],
                },
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
              professionalId: { in: professionalIds },
            },
            select: { startsAt: true, endsAt: true, professionalId: true },
          }),
        ]);

        const scheduleIds = schedules.map((schedule) => schedule.id);
        const templates = scheduleIds.length
          ? await prisma.weeklyAvailabilityTemplate.findMany({
              where: { availabilityId: { in: scheduleIds } },
              select: { availabilityId: true, dayOfWeek: true, intervals: true },
            })
          : [];
        const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
        const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
        const schedulesByScope = groupByScope(schedules);
        const overridesByScope = groupByScope(overrides);
        const blocks = [...buildBlocks(bookings), ...buildSessionBlocks(classSessions)];
        const matrix = buildHybridSlotMatrix({
          rangeStart,
          rangeEnd,
          timezone,
          durationMinutes: effectiveDurationMinutes,
          stepMinutes: bookingPolicy.gridMinutes,
          now,
          professionals,
          resources,
          orgSchedules: orgSchedules as ScopedSchedule[],
          templates: templates as ScopedTemplate[],
          orgOverrides: orgOverrides as ScopedOverride[],
          schedulesByScope,
          overridesByScope,
          blocks,
        });
        const items = matrix.slots
          .filter((slot) => isAlignedToGrid(slot.startsAt, timezone, bookingPolicy.gridMinutes))
          .map((slot) => ({
            slotKey: slot.startsAt.toISOString(),
            startsAt: slot.startsAt.toISOString(),
            durationMinutes: slot.durationMinutes,
            status: "OPEN",
          }));
        return jsonWrap({ ok: true, items, selectionRules, bookingPolicy: bookingPolicyPayload });
      }

      const assignmentMode: Exclude<typeof availabilityMode, "HYBRID"> = availabilityMode;
      const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
      let scopeIds: number[] = [];

      if (assignmentMode === "RESOURCE") {
        if (allowedResourceIds && allowedResourceIds.length === 0) {
          return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
        }
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(requestedCourtId ? { courtId: requestedCourtId } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = resources.map((resource) => resource.id);
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
            return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
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
        return jsonWrap({ ok: true, items: [], selectionRules, bookingPolicy: bookingPolicyPayload });
      }

      const scopeFilters = [
        { scopeType: "ORGANIZATION" as const, scopeId: 0 },
        { scopeType, scopeId: { in: scopeIds } },
      ];
      const [schedules, overrides, bookings, classSessions] = await Promise.all([
        prisma.availabilitySchedule.findMany({
          where: {
            organizationId: service.organizationId,
            OR: scopeFilters,
          },
          select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
        }),
        prisma.availabilityOverride.findMany({
          where: {
            organizationId: service.organizationId,
            OR: scopeFilters,
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
              { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
            ],
          },
          select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
        }),
        assignmentMode === "PROFESSIONAL"
          ? prisma.classSession.findMany({
              where: {
                organizationId: service.organizationId,
                status: "SCHEDULED",
                startsAt: { lt: rangeEnd },
                endsAt: { gt: rangeStart },
                ...(scopeIds.length > 0 ? { professionalId: { in: scopeIds } } : {}),
              },
              select: { startsAt: true, endsAt: true, professionalId: true },
            })
          : Promise.resolve([]),
      ]);

      const scheduleIds = schedules.map((schedule) => schedule.id);
      const templates = scheduleIds.length
        ? await prisma.weeklyAvailabilityTemplate.findMany({
            where: { availabilityId: { in: scheduleIds } },
            select: { availabilityId: true, dayOfWeek: true, intervals: true },
          })
        : [];
      const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const schedulesByScope = groupByScope(schedules);
      const overridesByScope = groupByScope(overrides);
      const blocks = [...buildBlocks(bookings), ...buildSessionBlocks(classSessions)];
      const slotMap = new Map<string, { startsAt: Date; durationMinutes: number }>();
      const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = scopeIds.map((id) => ({
        scopeType,
        scopeId: id,
      }));

      scopesToCheck.forEach((scope) => {
        const slots = getAvailableSlotsForScope({
          rangeStart,
          rangeEnd,
          timezone,
          durationMinutes: effectiveDurationMinutes,
          stepMinutes: bookingPolicy.gridMinutes,
          now,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          orgSchedules: orgSchedules as ScopedSchedule[],
          templates: templates as ScopedTemplate[],
          orgOverrides: orgOverrides as ScopedOverride[],
          schedulesByScope,
          overridesByScope,
          blocks,
        });
        slots.forEach((slot) => {
          if (!isAlignedToGrid(slot.startsAt, timezone, bookingPolicy.gridMinutes)) return;
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

      return jsonWrap({ ok: true, items, selectionRules, bookingPolicy: bookingPolicyPayload });
    }

    const monthParam = parseMonthParam(req.nextUrl.searchParams.get("month"));
    const todayParts = getDateParts(new Date(), timezone);
    const targetMonth = monthParam ?? { year: todayParts.year, month: todayParts.month };
    const monthKey = (targetMonth.year * 12) + (targetMonth.month - 1);
    const minKey = (todayParts.year * 12) + (todayParts.month - 1);
    const maxKey = minKey + 3;
    if (monthKey < minKey || monthKey > maxKey) {
      return jsonWrap({ ok: false, error: "RANGE_NOT_ALLOWED" }, { status: 400 });
    }
    const { start, end, lastDay } = buildMonthRange({ ...targetMonth, timezone });

    const professionalId = parsePositiveInt(req.nextUrl.searchParams.get("professionalId"));
    const partySizeRaw = parsePositiveInt(req.nextUrl.searchParams.get("partySize"));
    const partySizeValidation = validateRequestedPartySize({
      requested: partySizeRaw,
      rules: partySizeRules,
    });
    if (!partySizeValidation.ok) {
      return jsonWrap(
        { ok: false, error: partySizeValidation.errorCode, message: partySizeValidation.message },
        { status: 400 },
      );
    }
    const partySize = partySizeValidation.partySize;
    const durationOverride = parsePositiveInt(req.nextUrl.searchParams.get("durationMinutes"));
    const addonSelection = normalizeAddonSelection(req.nextUrl.searchParams.get("addons"));
    const packageIdRaw = req.nextUrl.searchParams.get("packageId");
    const packageId = parsePackageId(packageIdRaw);
    if (packageIdRaw && !packageId) {
      return jsonWrap({ ok: false, error: "Pacote inválido." }, { status: 400 });
    }

    const buildEmptyDays = () =>
      Array.from({ length: lastDay }, (_, idx) => {
        const day = idx + 1;
        const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
        return { date: key, hasAvailability: false, slots: 0 };
      });
    const respondMonth = (days: Array<{ date: string; hasAvailability: boolean; slots: number }>) =>
      jsonWrap({
        ok: true,
        timezone,
        month: `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`,
        days,
        selectionRules,
        bookingPolicy: bookingPolicyPayload,
      });

    const isCourtService = service.kind === "COURT";
    let effectiveDurationMinutes = service.durationMinutes;
    let effectivePriceCents = service.unitPriceCents ?? 0;
    let baseDurationMinutes = service.durationMinutes;
    let basePriceCents = service.unitPriceCents ?? 0;
    if (packageId && !isCourtService) {
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
    const durationValidation = validateDurationAgainstPolicy({
      durationMinutes: effectiveDurationMinutes,
      policy: bookingPolicy,
    });
    if (!durationValidation.ok) {
      return jsonWrap(
        { ok: false, error: durationValidation.errorCode, message: durationValidation.message },
        { status: 400 },
      );
    }
    if (isCourtService) {
      const courtDurationPrice = await resolveCourtDurationPrice({
        tx: prisma,
        serviceId: service.id,
        durationMinutes: effectiveDurationMinutes,
      });
      if (!courtDurationPrice) {
        return jsonWrap(
          { ok: false, error: "DURATION_NOT_PRICED", message: "Duração sem preço configurado." },
          { status: 400 },
        );
      }
      effectivePriceCents = Math.max(0, courtDurationPrice.priceCents + Math.max(0, effectivePriceCents - basePriceCents));
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

    const now = new Date();
    if (availabilityMode === "HYBRID") {
      let professionals: Array<{ id: number; priority: number }> = [];
      if (professionalId) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalId)) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalId, organizationId: service.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        professionals = [professional];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return respondMonth(buildEmptyDays());
        }
        professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
      }
      if (professionals.length === 0) {
        return respondMonth(buildEmptyDays());
      }

      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return respondMonth(buildEmptyDays());
      }
      const resources = await prisma.reservationResource.findMany({
        where: {
          organizationId: service.organizationId,
          isActive: true,
          ...(partySize != null ? { capacity: { gte: partySize } } : {}),
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
          ...(requestedCourtId ? { courtId: requestedCourtId } : {}),
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true, capacity: true, priority: true, courtId: true },
      });
      if (resources.length === 0) {
        return respondMonth(buildEmptyDays());
      }

      const professionalIds = professionals.map((item) => item.id);
      const resourceIds = resources.map((item) => item.id);
      const scopeFilters = [
        { scopeType: "ORGANIZATION" as const, scopeId: 0 },
        { scopeType: "PROFESSIONAL" as const, scopeId: { in: professionalIds } },
        { scopeType: "RESOURCE" as const, scopeId: { in: resourceIds } },
      ];
      const [schedules, overrides, bookings, classSessions] = await Promise.all([
        prisma.availabilitySchedule.findMany({
          where: {
            organizationId: service.organizationId,
            OR: scopeFilters,
          },
          select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
        }),
        prisma.availabilityOverride.findMany({
          where: {
            organizationId: service.organizationId,
            OR: scopeFilters,
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
            AND: [
              {
                OR: [
                  { professionalId: { in: professionalIds } },
                  { resourceId: { in: resourceIds } },
                ],
              },
              {
                OR: [
                  { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
                  {
                    status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
                    pendingExpiresAt: { gt: now },
                    startsAt: { gt: now },
                  },
                ],
              },
            ],
          },
          select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
        }),
        prisma.classSession.findMany({
          where: {
            organizationId: service.organizationId,
            status: "SCHEDULED",
            startsAt: { lt: end },
            endsAt: { gt: new Date(start.getTime() - 24 * 60 * 60 * 1000) },
            professionalId: { in: professionalIds },
          },
          select: { startsAt: true, endsAt: true, professionalId: true },
        }),
      ]);

      const scheduleIds = schedules.map((schedule) => schedule.id);
      const templates = scheduleIds.length
        ? await prisma.weeklyAvailabilityTemplate.findMany({
            where: { availabilityId: { in: scheduleIds } },
            select: { availabilityId: true, dayOfWeek: true, intervals: true },
          })
        : [];
      const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const schedulesByScope = groupByScope(schedules);
      const overridesByScope = groupByScope(overrides);
      const blocks = [...buildBlocks(bookings), ...buildSessionBlocks(classSessions)];
      const matrix = buildHybridSlotMatrix({
        rangeStart: start,
        rangeEnd: end,
        timezone,
        durationMinutes: effectiveDurationMinutes,
        stepMinutes: bookingPolicy.gridMinutes,
        now,
        professionals,
        resources,
        orgSchedules: orgSchedules as ScopedSchedule[],
        templates: templates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        schedulesByScope,
        overridesByScope,
        blocks,
      });

      const slotMap = new Map<string, number>();
      matrix.slots.forEach((slot) => {
        if (!isAlignedToGrid(slot.startsAt, timezone, bookingPolicy.gridMinutes)) return;
        const parts = getDateParts(slot.startsAt, timezone);
        const key = buildDateKey(parts);
        slotMap.set(key, (slotMap.get(key) ?? 0) + 1);
      });
      const days = Array.from({ length: lastDay }, (_, idx) => {
        const day = idx + 1;
        const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
        if (targetMonth.year === todayParts.year && targetMonth.month === todayParts.month && day < todayParts.day) {
          return { date: key, hasAvailability: false, slots: 0 };
        }
        return { date: key, hasAvailability: slotMap.has(key), slots: slotMap.get(key) ?? 0 };
      });
      return respondMonth(days);
    }

    const assignmentMode: Exclude<typeof availabilityMode, "HYBRID"> = availabilityMode;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (assignmentMode === "RESOURCE") {
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return respondMonth(buildEmptyDays());
      }
      const resources = await prisma.reservationResource.findMany({
        where: {
          organizationId: service.organizationId,
          isActive: true,
          ...(partySize != null ? { capacity: { gte: partySize } } : {}),
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
          ...(requestedCourtId ? { courtId: requestedCourtId } : {}),
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      scopeIds = resources.map((resource) => resource.id);
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
          return respondMonth(buildEmptyDays());
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
      return respondMonth(buildEmptyDays());
    }

    const scopeFilters = [
      { scopeType: "ORGANIZATION" as const, scopeId: 0 },
      { scopeType, scopeId: { in: scopeIds } },
    ];
    const [schedules, overrides, bookings, classSessions] = await Promise.all([
      prisma.availabilitySchedule.findMany({
        where: {
          organizationId: service.organizationId,
          OR: scopeFilters,
        },
        select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: service.organizationId,
          OR: scopeFilters,
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
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
          ],
        },
        select: { startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      assignmentMode === "PROFESSIONAL"
        ? prisma.classSession.findMany({
            where: {
              organizationId: service.organizationId,
              status: "SCHEDULED",
              startsAt: { lt: end },
              endsAt: { gt: new Date(start.getTime() - 24 * 60 * 60 * 1000) },
              ...(scopeIds.length > 0 ? { professionalId: { in: scopeIds } } : {}),
            },
            select: { startsAt: true, endsAt: true, professionalId: true },
          })
        : Promise.resolve([]),
    ]);

    const scheduleIds = schedules.map((schedule) => schedule.id);
    const templates = scheduleIds.length
      ? await prisma.weeklyAvailabilityTemplate.findMany({
          where: { availabilityId: { in: scheduleIds } },
          select: { availabilityId: true, dayOfWeek: true, intervals: true },
        })
      : [];
    const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const schedulesByScope = groupByScope(schedules);
    const overridesByScope = groupByScope(overrides);
    const blocks = [...buildBlocks(bookings), ...buildSessionBlocks(classSessions)];

    const slotMap = new Map<string, number>();
    const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = scopeIds.map((id) => ({
      scopeType,
      scopeId: id,
    }));

    scopesToCheck.forEach((scope) => {
      const slots = getAvailableSlotsForScope({
        rangeStart: start,
        rangeEnd: end,
        timezone,
        durationMinutes: effectiveDurationMinutes,
        stepMinutes: bookingPolicy.gridMinutes,
        now,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        orgSchedules: orgSchedules as ScopedSchedule[],
        templates: templates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        schedulesByScope,
        overridesByScope,
        blocks,
      });
      slots.forEach((slot) => {
        if (!isAlignedToGrid(slot.startsAt, timezone, bookingPolicy.gridMinutes)) return;
        const parts = getDateParts(slot.startsAt, timezone);
        const key = buildDateKey(parts);
        slotMap.set(key, (slotMap.get(key) ?? 0) + 1);
      });
    });

    const days = Array.from({ length: lastDay }, (_, idx) => {
      const day = idx + 1;
      const key = buildDateKey({ year: targetMonth.year, month: targetMonth.month, day });
      if (targetMonth.year === todayParts.year && targetMonth.month === todayParts.month && day < todayParts.day) {
        return { date: key, hasAvailability: false, slots: 0 };
      }
      return { date: key, hasAvailability: slotMap.has(key), slots: slotMap.get(key) ?? 0 };
    });

    return respondMonth(days);
  } catch (err) {
    console.error("GET /api/servicos/[id]/calendario error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar calendário." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
