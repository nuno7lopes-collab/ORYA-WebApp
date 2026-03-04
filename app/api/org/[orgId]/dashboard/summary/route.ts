import { NextRequest } from "next/server";
import { BookingStatus, EventTemplateType, OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildScopedSlotsForRange, groupByScope } from "@/lib/reservas/scopedAvailability";
import { EVENT_OPERATIONAL_STATUSES } from "@/domain/events/lifecycle";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import {
  buildOrganizationOccupancyMap,
  computeDeltaRate,
  computeOccupancyCoverage,
  computeOrganizationOccupancyRate,
  computeOrganizationOccupancyCoverage,
  computePadelCapacity,
  computePlatformAverageOccupancyRate,
  parsePadelMaxEntriesTotal,
  type DashboardKpiValue,
} from "@/domain/dashboard/clubSummaryKpis";
import {
  getOrganizationAnalyticsOverviewMetrics,
  resolveAnalyticsOverviewRangeBounds,
} from "@/domain/analytics/organizationOverviewMetrics";

const COMMERCIAL_WINDOW_DAYS = 30;
const CLUB_OCCUPANCY_WINDOW_DAYS = 30;
const COURT_OCCUPANCY_WINDOW_DAYS = 7;
const COURT_SLOT_MINUTES = 30;
const DEFAULT_TIMEZONE = "Europe/Lisbon";
const MIN_OCCUPANCY_COVERAGE_RATE = 0.6;

const BOOKING_CONFIRMED_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

function isoDateOnly(value: Date, timezone: string) {
  return value.toLocaleDateString("en-CA", { timeZone: timezone });
}

function normalizeTimezone(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfDayInTz(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function toKpi<T>(value: T | null, fallbackReason: string): DashboardKpiValue<T> {
  return value === null
    ? { status: "NO_DATA", value: null, reason: fallbackReason }
    : { status: "AVAILABLE", value };
}

function forbiddenKpi<T>(reason: string): DashboardKpiValue<T> {
  return { status: "FORBIDDEN", value: null, reason };
}

function toCoverageLabel(withCapacity: number, total: number) {
  return `${withCapacity}/${total}`;
}

async function loadPadelOccupancyRows(params: { from: Date; to: Date }) {
  const events = await prisma.event.findMany({
    where: {
      isDeleted: false,
      templateType: EventTemplateType.PADEL,
      status: { in: EVENT_OPERATIONAL_STATUSES },
      startsAt: { gte: params.from, lte: params.to },
    },
    select: {
      id: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          advancedSettings: true,
        },
      },
    },
  });
  if (!events.length) return [];

  const eventIds = events.map((event) => event.id);
  const categoryLinks = await prisma.padelEventCategoryLink.findMany({
    where: {
      eventId: { in: eventIds },
      isEnabled: true,
    },
    select: {
      eventId: true,
      capacityTeams: true,
      capacityPlayers: true,
    },
  });
  const pairings = await prisma.padelPairing.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: eventIds },
      pairingStatus: { not: "CANCELLED" },
      ...ACTIVE_PAIRING_REGISTRATION_WHERE,
    },
    _count: { _all: true },
  });

  const categoryCapacitiesByEvent = new Map<number, Array<number | null>>();
  categoryLinks.forEach((link) => {
    const item = link.capacityTeams ?? link.capacityPlayers ?? null;
    const current = categoryCapacitiesByEvent.get(link.eventId) ?? [];
    current.push(item);
    categoryCapacitiesByEvent.set(link.eventId, current);
  });
  const soldByEvent = new Map<number, number>();
  pairings.forEach((row) => {
    soldByEvent.set(row.eventId, row._count._all);
  });

  return events.map((event) => {
    const maxEntriesTotal = parsePadelMaxEntriesTotal(event.padelTournamentConfig?.advancedSettings);
    const capacity = computePadelCapacity({
      maxEntriesTotal,
      categoryCapacities: categoryCapacitiesByEvent.get(event.id) ?? [],
    });
    return {
      eventId: event.id,
      organizationId: event.organizationId ?? 0,
      sold: soldByEvent.get(event.id) ?? 0,
      capacity,
    };
  });
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      includeOrganizationFields: "settings",
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const [analyticsAccess, reservasAccess, torneiosAccess, eventosAccess] = await Promise.all([
      ensureMemberModuleAccess({
        organizationId: organization.id,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.ANALYTICS,
        required: "VIEW",
      }),
      ensureMemberModuleAccess({
        organizationId: organization.id,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.RESERVAS,
        required: "VIEW",
      }),
      ensureMemberModuleAccess({
        organizationId: organization.id,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.TORNEIOS,
        required: "VIEW",
      }),
      ensureMemberModuleAccess({
        organizationId: organization.id,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.EVENTOS,
        required: "VIEW",
      }),
    ]);

    const now = new Date();
    const timezone = normalizeTimezone(organization.timezone);
    const commercialWindow = resolveAnalyticsOverviewRangeBounds("30d", now);
    const commercialFrom = commercialWindow.from ?? addDays(now, -COMMERCIAL_WINDOW_DAYS);
    const commercialTo = commercialWindow.to ?? now;
    const clubFrom = now;
    const clubTo = addDays(now, CLUB_OCCUPANCY_WINDOW_DAYS);
    const courtFrom = now;
    const courtTo = addDays(now, COURT_OCCUPANCY_WINDOW_DAYS);
    const courtRangeStartDate = startOfDayInTz(courtFrom, timezone);
    const courtRangeEndDate = startOfDayInTz(courtTo, timezone);

    const ticketsKpi: DashboardKpiValue<number> = analyticsAccess.ok
      ? { status: "AVAILABLE", value: 0 }
      : forbiddenKpi("Sem acesso ao módulo de analytics.");
    const netRevenueKpi: DashboardKpiValue<number> = analyticsAccess.ok
      ? { status: "AVAILABLE", value: 0 }
      : forbiddenKpi("Sem acesso ao módulo de analytics.");

    if (analyticsAccess.ok) {
      const commercial = await getOrganizationAnalyticsOverviewMetrics({
        organizationId: organization.id,
        range: "30d",
        includeTemplateType: EventTemplateType.PADEL,
        preferredCurrency: "EUR",
      });
      ticketsKpi.value = commercial.totalTickets;
      netRevenueKpi.value = commercial.netRevenueCents;
    }

    let activeServicesKpi: DashboardKpiValue<number> = forbiddenKpi("Sem acesso ao módulo de reservas.");
    let fieldOccupancyRateKpi: DashboardKpiValue<number> = forbiddenKpi("Sem acesso ao módulo de reservas.");
    if (reservasAccess.ok) {
      const resources = await prisma.reservationResource.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
        },
        select: { id: true },
      });
      const resourceIds = resources.map((resource) => resource.id);
      const servicesActive = await prisma.service.count({
        where: {
          organizationId: organization.id,
          isActive: true,
        },
      });
      activeServicesKpi = toKpi(servicesActive, "Sem serviços ativos.");

      if (resourceIds.length === 0) {
        fieldOccupancyRateKpi = toKpi<number>(null, "Sem recursos ativos para calcular ocupação.");
      } else {
        const schedules = await prisma.availabilitySchedule.findMany({
          where: {
            organizationId: organization.id,
            scopeType: { in: ["ORGANIZATION", "RESOURCE"] },
            startDate: { lte: courtRangeEndDate },
            OR: [{ endDate: null }, { endDate: { gte: courtRangeStartDate } }],
          },
          select: {
            id: true,
            scopeType: true,
            scopeId: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        });
        const scheduleIds = schedules.map((schedule) => schedule.id);
        const templates = scheduleIds.length
          ? await prisma.weeklyAvailabilityTemplate.findMany({
              where: { availabilityId: { in: scheduleIds } },
              select: {
                availabilityId: true,
                dayOfWeek: true,
                intervals: true,
              },
            })
          : [];
        const overrides = await prisma.availabilityOverride.findMany({
          where: {
            organizationId: organization.id,
            scopeType: { in: ["ORGANIZATION", "RESOURCE"] },
            date: { gte: courtRangeStartDate, lte: courtRangeEndDate },
          },
          select: {
            scopeType: true,
            scopeId: true,
            date: true,
            kind: true,
            intervals: true,
          },
        });

        const scopedSchedules = schedules.map((schedule) => ({
          ...schedule,
          scopeType: schedule.scopeType as "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE",
        }));
        const scopedOverrides = overrides.map((override) => ({
          ...override,
          scopeType: override.scopeType as "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE",
        }));
        const orgSchedules = scopedSchedules.filter((schedule) => schedule.scopeType === "ORGANIZATION");
        const orgOverrides = scopedOverrides.filter((override) => override.scopeType === "ORGANIZATION");
        const schedulesByScope = groupByScope(scopedSchedules.filter((schedule) => schedule.scopeType !== "ORGANIZATION"));
        const overridesByScope = groupByScope(scopedOverrides.filter((override) => override.scopeType !== "ORGANIZATION"));

        let totalAvailableSlots = 0;
        for (const resourceId of resourceIds) {
          const slots = buildScopedSlotsForRange({
            rangeStart: courtFrom,
            rangeEnd: courtTo,
            timezone,
            durationMinutes: COURT_SLOT_MINUTES,
            stepMinutes: COURT_SLOT_MINUTES,
            now,
            scopeType: "RESOURCE",
            scopeId: resourceId,
            orgSchedules,
            templates,
            orgOverrides,
            schedulesByScope,
            overridesByScope,
          });
          totalAvailableSlots += slots.length;
        }

        const bookings = await prisma.booking.findMany({
          where: {
            organizationId: organization.id,
            resourceId: { in: resourceIds },
            status: { in: BOOKING_CONFIRMED_STATUSES },
            startsAt: { gte: courtFrom, lt: courtTo },
          },
          select: {
            durationMinutes: true,
          },
        });
        const totalBookedSlots = bookings.reduce((sum, booking) => {
          const slotCount = Math.max(1, Math.ceil((booking.durationMinutes ?? 0) / COURT_SLOT_MINUTES));
          return sum + slotCount;
        }, 0);

        const occupancyRate =
          totalAvailableSlots > 0
            ? Math.max(0, Math.min(1, totalBookedSlots / totalAvailableSlots))
            : null;
        fieldOccupancyRateKpi = toKpi(occupancyRate, "Sem disponibilidade publicada para o período.");
      }
    }

    let upcomingTournamentsKpi: DashboardKpiValue<number> =
      forbiddenKpi("Sem acesso ao módulo de torneios/eventos.");
    let clubOccupancyRateKpi: DashboardKpiValue<number> =
      forbiddenKpi("Sem acesso ao módulo de torneios/eventos.");
    let platformOccupancyRateKpi: DashboardKpiValue<number> =
      forbiddenKpi("Sem acesso ao módulo de torneios/eventos.");
    let clubVsPlatformDeltaKpi: DashboardKpiValue<number> =
      forbiddenKpi("Sem acesso ao módulo de torneios/eventos.");

    const canReadCompetitive = torneiosAccess.ok || eventosAccess.ok;
    if (canReadCompetitive) {
      const [occupancyRows, upcomingTournaments] = await Promise.all([
        loadPadelOccupancyRows({ from: clubFrom, to: clubTo }),
        prisma.event.count({
          where: {
            organizationId: organization.id,
            isDeleted: false,
            templateType: EventTemplateType.PADEL,
            status: { in: EVENT_OPERATIONAL_STATUSES },
            startsAt: { gte: clubFrom, lte: clubTo },
          },
        }),
      ]);

      const occupancyMap = buildOrganizationOccupancyMap(occupancyRows);
      const clubStats = computeOrganizationOccupancyRate(occupancyMap, organization.id);
      const platformStats = computePlatformAverageOccupancyRate(occupancyMap);
      const delta = computeDeltaRate(clubStats.rate, platformStats.rate);
      const clubCoverage = computeOrganizationOccupancyCoverage(occupancyRows, organization.id);
      const platformCoverage = computeOccupancyCoverage(occupancyRows);
      const clubCoverageInsufficient =
        typeof clubCoverage.coverageRate === "number" && clubCoverage.coverageRate < MIN_OCCUPANCY_COVERAGE_RATE;
      const platformCoverageInsufficient =
        typeof platformCoverage.coverageRate === "number" &&
        platformCoverage.coverageRate < MIN_OCCUPANCY_COVERAGE_RATE;

      upcomingTournamentsKpi = toKpi(upcomingTournaments, "Sem torneios no período.");
      if (clubCoverage.totalEvents === 0) {
        clubOccupancyRateKpi = toKpi<number>(null, "Sem torneios no período.");
      } else if (clubCoverage.eventsWithCapacity === 0) {
        clubOccupancyRateKpi = toKpi<number>(null, "Sem torneios com lotação definida no período.");
      } else if (clubCoverageInsufficient) {
        clubOccupancyRateKpi = toKpi<number>(
          null,
          `Cobertura de lotação insuficiente (${toCoverageLabel(clubCoverage.eventsWithCapacity, clubCoverage.totalEvents)} torneios).`,
        );
      } else {
        clubOccupancyRateKpi = toKpi(clubStats.rate, "Sem torneios com lotação definida no período.");
      }

      if (platformCoverage.totalEvents === 0) {
        platformOccupancyRateKpi = toKpi<number>(null, "Sem benchmark disponível para o período.");
      } else if (platformCoverage.eventsWithCapacity === 0) {
        platformOccupancyRateKpi = toKpi<number>(null, "Sem benchmark disponível para o período.");
      } else if (platformCoverageInsufficient) {
        platformOccupancyRateKpi = toKpi<number>(
          null,
          `Benchmark com cobertura insuficiente (${toCoverageLabel(platformCoverage.eventsWithCapacity, platformCoverage.totalEvents)} torneios).`,
        );
      } else {
        platformOccupancyRateKpi = toKpi(platformStats.rate, "Sem benchmark disponível para o período.");
      }

      if (clubOccupancyRateKpi.status === "AVAILABLE" && platformOccupancyRateKpi.status === "AVAILABLE") {
        clubVsPlatformDeltaKpi = toKpi(delta, "Sem benchmark disponível para calcular delta.");
      } else {
        clubVsPlatformDeltaKpi = toKpi<number>(null, "Sem benchmark robusto para calcular delta.");
      }
    }

    const previousDay = addDays(now, -1);

    return jsonWrap(
      {
        ok: true,
        generatedAt: now.toISOString(),
        windows: {
          commercial: {
            from: commercialFrom.toISOString(),
            to: commercialTo.toISOString(),
            days: COMMERCIAL_WINDOW_DAYS,
          },
          clubOccupancy: {
            from: clubFrom.toISOString(),
            to: clubTo.toISOString(),
            days: CLUB_OCCUPANCY_WINDOW_DAYS,
          },
          fieldOccupancy: {
            from: courtFrom.toISOString(),
            to: courtTo.toISOString(),
            days: COURT_OCCUPANCY_WINDOW_DAYS,
            slotMinutes: COURT_SLOT_MINUTES,
          },
        },
        kpis: {
          fieldOccupancyRate: fieldOccupancyRateKpi,
          clubOccupancyRate: clubOccupancyRateKpi,
          platformClubOccupancyRate: platformOccupancyRateKpi,
          clubVsPlatformDeltaRate: clubVsPlatformDeltaKpi,
          ticketsLast30Days: ticketsKpi,
          netRevenueLast30DaysCents: netRevenueKpi,
          activeServices: activeServicesKpi,
          upcomingTournaments: upcomingTournamentsKpi,
        },
        aiPlaceholder: {
          previousDayDate: isoDateOnly(previousDay, timezone),
          placeholder: true,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/org/dashboard/summary] failed", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
