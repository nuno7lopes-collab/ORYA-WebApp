import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { OrgType, Prisma } from "@prisma/client";
import { findNextSlot } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";

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

async function _GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const cityParam = searchParams.get("city")?.trim();
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const priceMinParam = searchParams.get("priceMin");
    const priceMaxParam = searchParams.get("priceMax");
    const dateParam = searchParams.get("date");
    const dayParam = searchParams.get("day");
    const kindParam = searchParams.get("kind");
    const tagParam = searchParams.get("tag");

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
      cityParam ?? "",
      cursorParam ?? "",
      take,
      priceMinParam ?? "",
      priceMaxParam ?? "",
      dateParam ?? "",
      dayParam ?? "",
      kindParam ?? "",
      tagParam ?? "",
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

    if (cityParam && cityParam.toLowerCase() !== "portugal") {
      organizationFilter.city = { contains: cityParam, mode: "insensitive" };
    }

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

    if (tagParam && tagParam.trim()) {
      where.categoryTag = { contains: tagParam.trim(), mode: "insensitive" };
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
        kind: true,
        categoryTag: true,
        instructor: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            city: true,
            username: true,
            brandingAvatarUrl: true,
            timezone: true,
            reservationAssignmentMode: true,
          },
        },
      },
    });

    const hasMore = services.length > take;
    const trimmed = hasMore ? services.slice(0, take) : services;
    const organizationIds = Array.from(new Set(trimmed.map((service) => service.organization.id)));

    const [templates, overrides, bookings, professionals, resources] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: { organizationId: { in: organizationIds } },
        select: { organizationId: true, scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
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
          status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] },
          startsAt: { lt: endBoundary, gte: new Date(startBoundary.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { organizationId: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      prisma.reservationProfessional.findMany({
        where: { organizationId: { in: organizationIds }, isActive: true },
        select: { id: true, organizationId: true, priority: true },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
      }),
      prisma.reservationResource.findMany({
        where: { organizationId: { in: organizationIds }, isActive: true },
        select: { id: true, organizationId: true, capacity: true, priority: true },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
      }),
    ]);

    const templatesByOrg = new Map<number, typeof templates>();
    templates.forEach((template) => {
      const list = templatesByOrg.get(template.organizationId) ?? [];
      list.push(template);
      templatesByOrg.set(template.organizationId, list);
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

    const resourcesByOrg = new Map<number, Array<{ id: number; capacity: number; priority: number }>>();
    resources.forEach((resource) => {
      const list = resourcesByOrg.get(resource.organizationId) ?? [];
      list.push({ id: resource.id, capacity: resource.capacity, priority: resource.priority });
      resourcesByOrg.set(resource.organizationId, list);
    });

    const mapped = trimmed.map((service) => {
      const orgId = service.organization.id;
      const orgTemplatesAll = templatesByOrg.get(orgId) ?? [];
      const orgOverridesAll = overridesByOrg.get(orgId) ?? [];
      const blocks = bookingsByOrg.get(orgId) ?? [];
      const orgTemplates = orgTemplatesAll.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const orgOverrides = orgOverridesAll.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
      const templatesByScope = groupByScope(orgTemplatesAll);
      const overridesByScope = groupByScope(orgOverridesAll);

      const assignmentMode = resolveServiceAssignmentMode({
        organizationMode: service.organization.reservationAssignmentMode ?? null,
        serviceKind: service.kind ?? null,
      }).mode;
      let scopesToCheck: Array<{ scopeType: AvailabilityScopeType; scopeId: number }> = [];

      if (assignmentMode === "RESOURCE") {
        const orgResources = resourcesByOrg.get(orgId) ?? [];
        if (orgResources.length === 0) {
          return { ...service, nextAvailability: null };
        }
        scopesToCheck = orgResources.map((resource) => ({ scopeType: "RESOURCE", scopeId: resource.id }));
      } else {
        const orgProfessionals = professionalsByOrg.get(orgId) ?? [];
        scopesToCheck = orgProfessionals.length
          ? orgProfessionals.map((professional) => ({ scopeType: "PROFESSIONAL", scopeId: professional.id }))
          : [{ scopeType: "ORGANIZATION", scopeId: 0 }];
      }

      const slotMap = new Map<string, { startsAt: Date; durationMinutes: number }>();
      scopesToCheck.forEach((scope) => {
        const slots = getAvailableSlotsForScope({
          rangeStart: startBoundary,
          rangeEnd: endBoundary,
          timezone: service.organization.timezone || "Europe/Lisbon",
          durationMinutes: service.durationMinutes,
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
          slotMap.set(slot.startsAt.toISOString(), slot);
        });
      });

      const availableSlots = Array.from(slotMap.values()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const nextSlot = findNextSlot(availableSlots);
      return {
        ...service,
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
    console.error("GET /api/servicos/list error:", err);
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
