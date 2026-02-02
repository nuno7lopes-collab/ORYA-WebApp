export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { PORTUGAL_CITIES } from "@/config/cities";
import { Prisma } from "@prisma/client";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pickCanonicalField = (canonical: Prisma.JsonValue | null, ...keys: string[]) => {
  const record = asRecord(canonical);
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

async function _GET(req: NextRequest) {
  try {
    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_public_clubs",
      max: 120,
    });
    if (rateLimited) return rateLimited;

    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const city = params.get("city")?.trim() ?? "";
    const includeCourts = params.get("includeCourts") === "1";
    const limit = clampLimit(params.get("limit"));

    const where: Prisma.PadelClubWhereInput = {
      isActive: true,
      deletedAt: null,
      kind: "OWN",
      ...(city && city.toLowerCase() !== "portugal" && PORTUGAL_CITIES.includes(city as (typeof PORTUGAL_CITIES)[number])
        ? { city }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { shortName: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { city: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const clubs = await prisma.padelClub.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        shortName: true,
        courtsCount: true,
        slug: true,
        addressRef: {
          select: {
            formattedAddress: true,
            canonical: true,
          },
        },
        organization: {
          select: {
            publicName: true,
            username: true,
          },
        },
      },
    });

    const courtsByClub = new Map<number, { id: number; name: string; indoor: boolean; surface: string | null }[]>();
    if (includeCourts && clubs.length > 0) {
      const clubIds = clubs.map((club) => club.id);
      const courts = await prisma.padelClubCourt.findMany({
        where: { padelClubId: { in: clubIds }, isActive: true },
        select: { id: true, padelClubId: true, name: true, indoor: true, surface: true },
        orderBy: [{ padelClubId: "asc" }, { displayOrder: "asc" }],
      });
      courts.forEach((court) => {
        if (!courtsByClub.has(court.padelClubId)) {
          courtsByClub.set(court.padelClubId, []);
        }
        courtsByClub.get(court.padelClubId)!.push({
          id: court.id,
          name: court.name,
          indoor: court.indoor,
          surface: court.surface ?? null,
        });
      });
    }

    return jsonWrap(
      {
        ok: true,
        items: clubs.map((club) => ({
          id: club.id,
          name: club.name,
          shortName: club.shortName ?? club.name,
          city:
            pickCanonicalField(club.addressRef?.canonical ?? null, "city", "addressLine2") ?? null,
          address: club.addressRef?.formattedAddress ?? null,
          courtsCount: club.courtsCount ?? 0,
          slug: club.slug ?? null,
          organizationName: club.organization?.publicName ?? club.organization?.username ?? null,
          organizationUsername: club.organization?.username ?? null,
          courts: includeCourts ? courtsByClub.get(club.id) ?? [] : [],
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/public/clubs] error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
