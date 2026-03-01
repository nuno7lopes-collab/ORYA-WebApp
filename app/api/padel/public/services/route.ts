export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { Prisma, OrgType } from "@prisma/client";
import { PORTUGAL_CITIES } from "@/config/cities";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

function parseCursor(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCity(raw: string | null) {
  const cityRaw = raw?.trim() ?? "";
  if (!cityRaw || cityRaw.toLowerCase() === "portugal") return null;
  return PORTUGAL_CITIES.find((entry) => entry.toLowerCase() === cityRaw.toLowerCase()) ?? cityRaw;
}

async function _GET(req: NextRequest) {
  try {
    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_public_services",
      max: 120,
    });
    if (rateLimited) return rateLimited;

    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const city = normalizeCity(params.get("city"));
    const kindRaw = (params.get("kind") ?? "ALL").trim().toUpperCase();
    const limit = clampLimit(params.get("limit"));
    const cursor = parseCursor(params.get("cursor"));
    const dateParam = (params.get("date") ?? "").trim().toLowerCase();
    const dayParam = (params.get("day") ?? "").trim();
    const priceMinParam = params.get("priceMin");
    const priceMaxParam = params.get("priceMax");

    // Aceitamos date/day por contrato de API (filtro operacional futuro),
    // sem falhar pedidos existentes.
    void dateParam;
    void dayParam;

    if (kindRaw !== "ALL" && kindRaw !== "CLASS" && kindRaw !== "COURT") {
      return jsonWrap({ ok: false, error: "INVALID_KIND" }, { status: 400 });
    }

    const priceMin = priceMinParam ? Math.max(0, Number(priceMinParam)) : null;
    const parsedMax = priceMaxParam ? Number(priceMaxParam) : null;
    const priceMax = parsedMax !== null && Number.isFinite(parsedMax) ? Math.max(0, parsedMax) : null;
    const priceMinCents = priceMin !== null && Number.isFinite(priceMin) ? Math.round(priceMin * 100) : null;
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      organization: { status: "ACTIVE" },
      ...(kindRaw === "ALL" ? { kind: { in: ["CLASS", "COURT"] } } : { kind: kindRaw as "CLASS" | "COURT" }),
    };

    const andFilters: Prisma.ServiceWhereInput[] = [];

    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { organization: { publicName: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          { organization: { businessName: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          { category: { label: { contains: q, mode: Prisma.QueryMode.insensitive } } },
        ],
      });
    }

    if (city) {
      andFilters.push({
        OR: [
          { addressRef: { formattedAddress: { contains: city, mode: Prisma.QueryMode.insensitive } } },
          {
            organization: {
              addressRef: { formattedAddress: { contains: city, mode: Prisma.QueryMode.insensitive } },
            },
          },
        ],
      });
    }

    if (priceMinCents !== null || priceMaxCents !== null) {
      andFilters.push({
        unitPriceCents: {
          ...(priceMinCents !== null ? { gte: priceMinCents } : {}),
          ...(priceMaxCents !== null ? { lte: priceMaxCents } : {}),
        },
      });
    }

    andFilters.push({
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
    });

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const rows = await prisma.service.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ id: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        kind: true,
        category: { select: { label: true } },
        addressRef: { select: { formattedAddress: true } },
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            username: true,
            addressRef: { select: { formattedAddress: true } },
          },
        },
        instructor: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return jsonWrap(
      {
        ok: true,
        items: data.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? null,
          durationMinutes: item.durationMinutes,
          unitPriceCents: item.unitPriceCents,
          currency: item.currency,
          kind: item.kind === "CLASS" ? "CLASS" : "COURT",
          categoryLabel: item.category?.label ?? null,
          nextAvailability: null,
          addressFormatted:
            item.addressRef?.formattedAddress ?? item.organization.addressRef?.formattedAddress ?? null,
          organization: {
            id: item.organization.id,
            publicName: item.organization.publicName ?? null,
            businessName: item.organization.businessName ?? null,
            username: item.organization.username ?? null,
          },
          instructor: item.instructor
            ? {
                id: item.instructor.id,
                fullName: item.instructor.fullName ?? null,
                username: item.instructor.username ?? null,
              }
            : null,
        })),
        pagination: { nextCursor, hasMore },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/public/services] error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
