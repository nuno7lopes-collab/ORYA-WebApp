export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PORTUGAL_CITIES } from "@/config/cities";
import { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const city = params.get("city")?.trim() ?? "";
    const q = params.get("q")?.trim() ?? "";
    const limit = clampLimit(params.get("limit"));
    const now = new Date();

    const pairingWhere: Prisma.PadelPairingWhereInput = {
      pairingStatus: { not: "CANCELLED" },
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      OR: [{ pairingJoinMode: "LOOKING_FOR_PARTNER" }, { isPublicOpen: true }],
      event: {
        isDeleted: false,
        startsAt: { gte: now },
        ...(city && city.toLowerCase() !== "portugal" && PORTUGAL_CITIES.includes(city as (typeof PORTUGAL_CITIES)[number])
          ? { locationCity: { contains: city, mode: Prisma.QueryMode.insensitive } }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { locationName: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
    };

    const pairings = await prisma.padelPairing.findMany({
      where: pairingWhere,
      select: {
        id: true,
        payment_mode: true,
        deadlineAt: true,
        category: { select: { id: true, label: true } },
        slots: { select: { id: true, slotStatus: true } },
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            locationName: true,
            locationCity: true,
            coverImageUrl: true,
          },
        },
      },
      orderBy: [{ eventId: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json(
      {
        ok: true,
        items: pairings.map((pairing) => ({
          id: pairing.id,
          paymentMode: pairing.payment_mode,
          deadlineAt: pairing.deadlineAt?.toISOString() ?? null,
          category: pairing.category
            ? { id: pairing.category.id, label: pairing.category.label }
            : null,
          openSlots: pairing.slots.filter((s) => s.slotStatus === "PENDING").length,
          event: {
            id: pairing.event.id,
            slug: pairing.event.slug,
            title: pairing.event.title,
            startsAt: pairing.event.startsAt?.toISOString() ?? null,
            locationName: pairing.event.locationName ?? null,
            locationCity: pairing.event.locationCity ?? null,
            coverImageUrl: pairing.event.coverImageUrl ?? null,
          },
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/public/open-pairings] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
