import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { OrgType, Prisma } from "@prisma/client";
import { findNextSlot } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedSchedule, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";
import { resolveBookingGridPolicy } from "@/lib/reservas/gridPolicy";
import { resolveBookingVerticalFromServiceKind } from "@/lib/reservas/bookingVertical";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { PORTUGAL_CITIES } from "@/config/cities";
import { logError } from "@/lib/observability/logger";

const DEFAULT_PAGE_SIZE = 12;
const LOOKAHEAD_DAYS = 21;
const CACHE_TTL_MS = 30 * 1000;

function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

function buildAvailabilityRange(dateParam: string | null, dayParam: string | null) {
  if (dateParam === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (dateParam === "weekend") {
    const now = new Date();
    const day = now.getDay(); // 0 domingo ... 6 sábado
    let start = new Date(now);
    let end = new Date(now);
    if (day === 0) {
      start = now;
      end.setHours(23, 59, 59, 999);
    } else {
      const daysToSaturday = (6 - day + 7) % 7;
      start.setDate(now.getDate() + daysToSaturday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  if (dateParam === "day" && dayParam) {
    const parsed = new Date(dayParam);
    if (!Number.isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setHours(0, 0, 0, 0);
      const end = new Date(parsed);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  return null;
}

function normalizeCityFilter(raw: string | null) {
  const city = raw?.trim() ?? "";
  if (!city) return null;
  if (city.toLowerCase() === "portugal") return null;
  const matchedCity = PORTUGAL_CITIES.find((entry) => entry.toLowerCase() === city.toLowerCase());
  return matchedCity ?? city;
}

async function _GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const priceMinParam = searchParams.get("priceMin");
    const priceMaxParam = searchParams.get("priceMax");
    const dateParam = searchParams.get("date");
    const dayParam = searchParams.get("day");
    const kindParam = searchParams.get("kind");
    const tagParam = searchParams.get("tag");
    const categorySlugParam = searchParams.get("categorySlug");
    const categoryDomainParam = searchParams.get("categoryDomain");
    const cityParam = normalizeCityFilter(searchParams.get("city"));

    const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
    const cursorId = cursorParam ? Number(cursorParam) : null;
    const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
    const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
    const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;
    const priceMinCents = Math.round(priceMin * 100);
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

    const cacheKey = buildCacheKey([
      "servicos",
      q,
      cursorParam ?? "",
      take,
      priceMinParam ?? "",
      priceMaxParam ?? "",
      dateParam ?? "",
      dayParam ?? "",
      kindParam ?? "",
      tagParam ?? "",
      categorySlugParam ?? "",
      categoryDomainParam ?? "",
      cityParam ?? "",
    ]);
    const cached = getCache<Record<string, unknown>>(cacheKey);
    if (cached) {
      return jsonWrap(cached, { status: 200 });
    }

    const range = buildAvailabilityRange(dateParam, dayParam);
    const now = new Date();
    const startBoundary = range
      ? new Date(Math.max(range.start.getTime(), now.getTime()))
      : now;
    const endBoundary =
      range?.end ?? new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    const organizationFilter: Prisma.OrganizationWhereInput = {
      status: "ACTIVE",
    };

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      organization: organizationFilter,
    };

    if (kindParam) {
      const kind = kindParam.trim().toUpperCase();
      if (["GENERAL", "COURT", "CLASS"].includes(kind)) {
        where.kind = kind as Prisma.ServiceWhereInput["kind"];
      }
    } else {
      where.kind = { in: ["GENERAL", "COURT", "CLASS"] } as Prisma.ServiceWhereInput["kind"];
    }

    if (priceMinCents > 0 || priceMaxCents !== null) {
      where.unitPriceCents = {
        ...(priceMinCents > 0 ? { gte: priceMinCents } : {}),
        ...(priceMaxCents !== null ? { lte: priceMaxCents } : {}),
      };
    }

    const normalizedCategorySlug = categorySlugParam?.trim().toLowerCase() ?? "";
    const normalizedCategoryDomain = categoryDomainParam?.trim().toUpperCase() ?? "";
    const hasCategoryDomain = ["COURT", "CLASS", "SERVICE"].includes(normalizedCategoryDomain);
    if (normalizedCategorySlug || hasCategoryDomain) {
      where.category = {
        ...(normalizedCategorySlug ? { slug: normalizedCategorySlug } : {}),
        ...(hasCategoryDomain ? { domain: normalizedCategoryDomain as "COURT" | "CLASS" | "SERVICE" } : {}),
      };
    }

    if (tagParam && tagParam.trim()) {
      const legacyTag = tagParam.trim();
      const tagFilter: Prisma.ServiceWhereInput = {
        OR: [
          { categoryTag: { contains: legacyTag, mode: "insensitive" } },
          { category: { label: { contains: legacyTag, mode: "insensitive" } } },
          { category: { slug: { contains: legacyTag.toLowerCase(), mode: "insensitive" } } },
        ],
      };
      if (Array.isArray(where.AND)) {
        where.AND.push(tagFilter);
      } else {
        where.AND = [tagFilter];
      }
    }

    if (cityParam) {
      const cityFilter: Prisma.ServiceWhereInput = {
        OR: [
          { addressRef: { formattedAddress: { contains: cityParam, mode: "insensitive" } } },
          {
            organization: {
              addressRef: { formattedAddress: { contains: cityParam, mode: "insensitive" } },
            },
          },
        ],
      };
      if (Array.isArray(where.AND)) {
        where.AND.push(cityFilter);
      } else {
        where.AND = [cityFilter];
      }
    }

    if (range) {
      // Filtramos via próxima disponibilidade calculada (aplicado abaixo).
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { organization: { publicName: { contains: q, mode: "insensitive" } } },
        { organization: { businessName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const paidVisibilityFilter: Prisma.ServiceWhereInput = {
      OR: [
        { unitPriceCents: 0 },
        {
          organization: {
            officialEmailVerifiedAt: { not: null },
            officialEmail: { not: null },
            OR: [
              { orgType: OrgType.PLATFORM },
              {
                stripeAccountId: { not: null },
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
              },
            ],
          },
        },
      ],
    };
    if (Array.isArray(where.AND)) {
      where.AND.push(paidVisibilityFilter);
    } else {
      where.AND = [paidVisibilityFilter];
    }

    const services = await prisma.service.findMany({
      where,
      take: take + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { id: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        coverImageUrl: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        categoryId: true,
        categoryTag: true,
        category: {
          select: {
            id: true,
            slug: true,
            label: true,
            domain: true,
          },
        },
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
        professionalLinks: { select: { professionalId: true, professional: { select: { isActive: true } } } },
        resourceLinks: { select: { resourceId: true, resource: { select: { isActive: true } } } },
        instructor: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            username: true,
            brandingAvatarUrl: true,
            brandingCoverUrl: true,
            timezone: true,
            reservationAssignmentMode: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
          },
        },
      },
    });

    const hasMore = services.length > take;
    const trimmed = hasMore ? services.slice(0, take) : services;
    const organizationIds = Array.from(new Set(trimmed.map((service) => service.organization.id)));
    const courtServiceIds = trimmed
      .filter((service) => String(service.kind ?? "").toUpperCase() === "COURT")
      .map((service) => service.id);
    type BookingSettingsRow = {
      organizationId: number;
      bookingGridMinutes: number | null;
      bookingAllowedDurations: number[];
      bookingAllowCustomDuration: boolean | null;
    };
    const organizationSettingsClient = (
      prisma as unknown as {
        organizationSettings?: {
          findMany?: (args: unknown) => Promise<BookingSettingsRow[]>;
        };
      }
    ).organizationSettings;
    const bookingSettingsPromise: Promise<BookingSettingsRow[]> =
      typeof organizationSettingsClient?.findMany === "function"
        ? prisma.organizationSettings.findMany({
            where: { organizationId: { in: organizationIds } },
            select: {
              organizationId: true,
              bookingGridMinutes: true,
              bookingAllowedDurations: true,
              bookingAllowCustomDuration: true,
            },
          })
        : Promise.resolve([]);

    const [schedules, overrides, bookings, professionals, resources, bookingSettings, courtConfigs] = await Promise.all([
      prisma.availabilitySchedule.findMany({
        where: { organizationId: { in: organizationIds } },
        select: { id: true, organizationId: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: { in: organizationIds },
          date: {
            gte: new Date(Date.UTC(startBoundary.getUTCFullYear(), startBoundary.getUTCMonth(), startBoundary.getUTCDate())),
            lte: new Date(Date.UTC(endBoundary.getUTCFullYear(), endBoundary.getUTCMonth(), endBoundary.getUTCDate())),
          },
        },
        select: { organizationId: true, scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: { in: organizationIds },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
          ],
          startsAt: { lt: endBoundary, gte: new Date(startBoundary.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: {
          organizationId: true,
          startsAt: true,
          durationMinutes: true,
          professionalId: true,
          resourceId: true,
          status: true,
          pendingExpiresAt: true,
        },
      }),
      prisma.reservationProfessional.findMany({
        where: { organizationId: { in: organizationIds }, isActive: true },
        select: { id: true, organizationId: true, priority: true },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
      }),
      prisma.reservationResource.findMany({
        where: { organizationId: { in: organizationIds }, isActive: true },
        select: { id: true, organizationId: true, capacity: true, priority: true, courtId: true },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
      }),
      bookingSettingsPromise,
      courtServiceIds.length > 0
        ? prisma.courtBookingConfig.findMany({
            where: {
              organizationId: { in: organizationIds },
              backingServiceId: { in: courtServiceIds },
              isActive: true,
            },
            orderBy: [{ backingServiceId: "asc" }, { courtId: "asc" }],
            select: {
              backingServiceId: true,
              courtId: true,
              displayName: true,
              displayDescription: true,
              coverImageUrl: true,
              category: {
                select: {
                  id: true,
                  slug: true,
                  label: true,
                  domain: true,
                },
              },
            },
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
    const scheduleOrgMap = new Map<number, number>();
    const schedulesByOrg = new Map<number, typeof schedules>();
    schedules.forEach((schedule) => {
      scheduleOrgMap.set(schedule.id, schedule.organizationId);
      const list = schedulesByOrg.get(schedule.organizationId) ?? [];
      list.push(schedule);
      schedulesByOrg.set(schedule.organizationId, list);
    });

    const templatesByOrg = new Map<number, typeof templates>();
    templates.forEach((template) => {
      const orgId = scheduleOrgMap.get(template.availabilityId);
      if (!orgId) return;
      const list = templatesByOrg.get(orgId) ?? [];
      list.push(template);
      templatesByOrg.set(orgId, list);
    });

    const overridesByOrg = new Map<number, typeof overrides>();
    overrides.forEach((override) => {
      const list = overridesByOrg.get(override.organizationId) ?? [];
      list.push(override);
      overridesByOrg.set(override.organizationId, list);
    });

    const bookingsByOrg = new Map<number, Array<{ start: Date; end: Date; professionalId: number | null; resourceId: number | null }>>();
    bookings.forEach((booking) => {
      const list = bookingsByOrg.get(booking.organizationId) ?? [];
      list.push({
        start: booking.startsAt,
        end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        professionalId: booking.professionalId ?? null,
        resourceId: booking.resourceId ?? null,
      });
      bookingsByOrg.set(booking.organizationId, list);
    });

    const professionalsByOrg = new Map<number, Array<{ id: number; priority: number }>>();
    professionals.forEach((professional) => {
      const list = professionalsByOrg.get(professional.organizationId) ?? [];
      list.push({ id: professional.id, priority: professional.priority });
      professionalsByOrg.set(professional.organizationId, list);
    });

    const resourcesByOrg = new Map<number, Array<{ id: number; capacity: number; priority: number; courtId: number | null }>>();
    resources.forEach((resource) => {
      const list = resourcesByOrg.get(resource.organizationId) ?? [];
      list.push({ id: resource.id, capacity: resource.capacity, priority: resource.priority, courtId: resource.courtId ?? null });
      resourcesByOrg.set(resource.organizationId, list);
    });
    const bookingPolicyByOrg = new Map(
      bookingSettings.map((settings) => [
        settings.organizationId,
        resolveBookingGridPolicy({
          gridMinutes: settings.bookingGridMinutes,
          allowedDurations: settings.bookingAllowedDurations,
          allowCustomDuration: settings.bookingAllowCustomDuration,
        }),
      ]),
    );
    const courtConfigByServiceId = new Map<
      number,
      {
        backingServiceId: number;
        courtId: number;
        displayName: string | null;
        displayDescription: string | null;
        coverImageUrl: string | null;
        category: { id: number; slug: string; label: string; domain: "COURT" | "CLASS" | "SERVICE" } | null;
      }
    >();
    for (const config of courtConfigs) {
      if (!courtConfigByServiceId.has(config.backingServiceId)) {
        courtConfigByServiceId.set(config.backingServiceId, config);
      }
    }

    const mapped = trimmed.map((service) => {
      const orgId = service.organization.id;
      const bookingPolicy = bookingPolicyByOrg.get(orgId) ?? resolveBookingGridPolicy({});
      const orgTemplatesAll = templatesByOrg.get(orgId) ?? [];
      const orgOverridesAll = overridesByOrg.get(orgId) ?? [];
      const blocks = bookingsByOrg.get(orgId) ?? [];
      const orgSchedules = (schedulesByOrg.get(orgId) ?? []).filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const orgOverrides = orgOverridesAll.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const schedulesByScope = groupByScope(schedulesByOrg.get(orgId) ?? []);
      const overridesByScope = groupByScope(orgOverridesAll);

      const assignmentConfig = resolveServiceAssignmentMode({
        organizationMode: service.organization.reservationAssignmentMode ?? null,
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
      const minPartySize = partySizeRules.partySizeRequired ? partySizeRules.partySizeMin : null;
      const allowedProfessionalIds = service.professionalLinks?.length
        ? service.professionalLinks.filter((link) => link.professional?.isActive).map((link) => link.professionalId)
        : null;
      const allowedResourceIds = service.resourceLinks?.length
        ? service.resourceLinks.filter((link) => link.resource?.isActive).map((link) => link.resourceId)
        : null;

      const timezone = service.organization.timezone || "Europe/Lisbon";
      const orgProfessionalsAll = professionalsByOrg.get(orgId) ?? [];
      const orgResourcesAll = resourcesByOrg.get(orgId) ?? [];
      const orgProfessionals = allowedProfessionalIds
        ? orgProfessionalsAll.filter((professional) => allowedProfessionalIds.includes(professional.id))
        : orgProfessionalsAll;
      let orgResources = allowedResourceIds
        ? orgResourcesAll.filter((resource) => allowedResourceIds.includes(resource.id))
        : orgResourcesAll;
      if (assignmentConfig.isCourtService) {
        orgResources = orgResources.filter((resource) => (resource.courtId ?? null) != null);
      }
      if (minPartySize != null) {
        orgResources = orgResources.filter((resource) => resource.capacity >= minPartySize);
      }

      const slotByKey = new Map<string, { startsAt: Date; durationMinutes: number }>();
      let availableSlots: Array<{ startsAt: Date; durationMinutes: number }> = [];

      if (availabilityMode === "RESOURCE") {
        if (orgResources.length === 0) {
          return { ...service, nextAvailability: null };
        }
        orgResources.forEach((resource) => {
          const slots = getAvailableSlotsForScope({
            rangeStart: startBoundary,
            rangeEnd: endBoundary,
            timezone,
            durationMinutes: service.durationMinutes,
            stepMinutes: bookingPolicy.gridMinutes,
            now,
            scopeType: "RESOURCE",
            scopeId: resource.id,
            orgSchedules: orgSchedules as ScopedSchedule[],
            templates: orgTemplatesAll as ScopedTemplate[],
            orgOverrides: orgOverrides as ScopedOverride[],
            schedulesByScope,
            overridesByScope,
            blocks,
          });
          slots.forEach((slot) => {
            slotByKey.set(slot.startsAt.toISOString(), slot);
          });
        });
        availableSlots = Array.from(slotByKey.values());
      } else if (availabilityMode === "PROFESSIONAL") {
        const scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = orgProfessionals.length
          ? orgProfessionals.map((professional) => ({ scopeType: "PROFESSIONAL", scopeId: professional.id }))
          : [{ scopeType: "ORGANIZATION", scopeId: 0 }];
        scopesToCheck.forEach((scope) => {
          const slots = getAvailableSlotsForScope({
            rangeStart: startBoundary,
            rangeEnd: endBoundary,
            timezone,
            durationMinutes: service.durationMinutes,
            stepMinutes: bookingPolicy.gridMinutes,
            now,
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            orgSchedules: orgSchedules as ScopedSchedule[],
            templates: orgTemplatesAll as ScopedTemplate[],
            orgOverrides: orgOverrides as ScopedOverride[],
            schedulesByScope,
            overridesByScope,
            blocks,
          });
          slots.forEach((slot) => {
            slotByKey.set(slot.startsAt.toISOString(), slot);
          });
        });
        availableSlots = Array.from(slotByKey.values());
      } else {
        if (orgProfessionals.length === 0 || orgResources.length === 0) {
          return { ...service, nextAvailability: null };
        }
        const proKeys = new Set<string>();
        const resKeys = new Set<string>();
        orgProfessionals.forEach((professional) => {
          const slots = getAvailableSlotsForScope({
            rangeStart: startBoundary,
            rangeEnd: endBoundary,
            timezone,
            durationMinutes: service.durationMinutes,
            stepMinutes: bookingPolicy.gridMinutes,
            now,
            scopeType: "PROFESSIONAL",
            scopeId: professional.id,
            orgSchedules: orgSchedules as ScopedSchedule[],
            templates: orgTemplatesAll as ScopedTemplate[],
            orgOverrides: orgOverrides as ScopedOverride[],
            schedulesByScope,
            overridesByScope,
            blocks,
          });
          slots.forEach((slot) => {
            const key = slot.startsAt.toISOString();
            proKeys.add(key);
            slotByKey.set(key, slot);
          });
        });
        orgResources.forEach((resource) => {
          const slots = getAvailableSlotsForScope({
            rangeStart: startBoundary,
            rangeEnd: endBoundary,
            timezone,
            durationMinutes: service.durationMinutes,
            stepMinutes: bookingPolicy.gridMinutes,
            now,
            scopeType: "RESOURCE",
            scopeId: resource.id,
            orgSchedules: orgSchedules as ScopedSchedule[],
            templates: orgTemplatesAll as ScopedTemplate[],
            orgOverrides: orgOverrides as ScopedOverride[],
            schedulesByScope,
            overridesByScope,
            blocks,
          });
          slots.forEach((slot) => {
            const key = slot.startsAt.toISOString();
            resKeys.add(key);
            slotByKey.set(key, slot);
          });
        });
        availableSlots = Array.from(proKeys)
          .filter((key) => resKeys.has(key))
          .map((key) => slotByKey.get(key))
          .filter((slot): slot is { startsAt: Date; durationMinutes: number } => Boolean(slot));
      }

      availableSlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const nextSlot = findNextSlot(availableSlots);
      const courtConfig = assignmentConfig.isCourtService ? courtConfigByServiceId.get(service.id) ?? null : null;
      const resolvedCategory = courtConfig?.category ?? service.category ?? null;
      const resolvedTitle = courtConfig?.displayName?.trim() || service.title;
      const resolvedDescription = courtConfig?.displayDescription?.trim() || service.description || null;
      return {
        ...service,
        title: resolvedTitle,
        description: resolvedDescription,
        coverImageUrl: courtConfig?.coverImageUrl ?? service.coverImageUrl ?? null,
        courtId: courtConfig?.courtId ?? null,
        backingServiceId: assignmentConfig.isCourtService ? service.id : null,
        bookingVertical: resolveBookingVerticalFromServiceKind(service.kind),
        category: resolvedCategory
          ? {
              id: resolvedCategory.id,
              slug: resolvedCategory.slug,
              label: resolvedCategory.label,
              domain: resolvedCategory.domain,
            }
          : null,
        categoryTag: resolvedCategory?.label ?? service.categoryTag ?? null,
        nextAvailability: nextSlot?.startsAt.toISOString() ?? null,
      };
    });

    const items = range ? mapped.filter((item) => item.nextAvailability) : mapped;

    const payload = {
      ok: true,
      items,
      pagination: {
        nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null,
        hasMore,
      },
    };

    setCache(cacheKey, payload, CACHE_TTL_MS);

    return jsonWrap(payload);
  } catch (err) {
    logError("api.servicos.list", err);
    const debug =
      process.env.NODE_ENV !== "production"
        ? err instanceof Error
          ? err.message
          : String(err)
        : undefined;
    return jsonWrap(
      { ok: false, error: "Erro ao carregar serviços.", ...(debug ? { debug } : {}) },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
