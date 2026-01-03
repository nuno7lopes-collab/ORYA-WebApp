import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 12;

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

export async function GET(req: NextRequest) {
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

    const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
    const cursorId = cursorParam ? Number(cursorParam) : null;
    const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
    const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
    const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;
    const priceMinCents = Math.round(priceMin * 100);
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

    const range = buildAvailabilityRange(dateParam, dayParam);
    const now = new Date();
    const startBoundary = range
      ? new Date(Math.max(range.start.getTime(), now.getTime()))
      : now;

    const organizationFilter: Prisma.OrganizationWhereInput = {
      status: "ACTIVE",
      organizationCategory: "RESERVAS",
    };

    if (cityParam && cityParam.toLowerCase() !== "portugal") {
      organizationFilter.city = { contains: cityParam, mode: "insensitive" };
    }

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      organization: organizationFilter,
    };

    if (priceMinCents > 0 || priceMaxCents !== null) {
      where.price = {
        ...(priceMinCents > 0 ? { gte: priceMinCents } : {}),
        ...(priceMaxCents !== null ? { lte: priceMaxCents } : {}),
      };
    }

    if (range) {
      where.availabilities = {
        some: {
          status: "OPEN",
          startsAt: {
            gte: startBoundary,
            lte: range.end,
          },
        },
      };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { organization: { publicName: { contains: q, mode: "insensitive" } } },
        { organization: { businessName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      take: take + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        currency: true,
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            city: true,
            username: true,
            brandingAvatarUrl: true,
          },
        },
      },
    });

    const hasMore = services.length > take;
    const trimmed = hasMore ? services.slice(0, take) : services;
    const serviceIds = trimmed.map((service) => service.id);

    const availabilityWhere: Prisma.AvailabilityWhereInput = {
      serviceId: { in: serviceIds },
      status: "OPEN",
      startsAt: {
        gte: startBoundary,
        ...(range ? { lte: range.end } : {}),
      },
    };

    const availabilityRows = serviceIds.length
      ? await prisma.availability.findMany({
          where: availabilityWhere,
          orderBy: { startsAt: "asc" },
          select: { serviceId: true, startsAt: true },
        })
      : [];

    const nextAvailabilityByService = new Map<number, Date>();
    availabilityRows.forEach((row) => {
      if (!nextAvailabilityByService.has(row.serviceId)) {
        nextAvailabilityByService.set(row.serviceId, row.startsAt);
      }
    });

    return NextResponse.json({
      ok: true,
      items: trimmed.map((service) => ({
        ...service,
        nextAvailability: nextAvailabilityByService.get(service.id)?.toISOString() ?? null,
      })),
      pagination: {
        nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null,
        hasMore,
      },
    });
  } catch (err) {
    console.error("GET /api/servicos/list error:", err);
    const debug =
      process.env.NODE_ENV !== "production"
        ? err instanceof Error
          ? err.message
          : String(err)
        : undefined;
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar serviços.", ...(debug ? { debug } : {}) },
      { status: 500 },
    );
  }
}
