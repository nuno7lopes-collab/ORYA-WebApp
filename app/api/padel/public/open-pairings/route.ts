export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { PORTUGAL_CITIES } from "@/config/cities";
import { Prisma } from "@prisma/client";
import { checkPadelRegistrationWindow, INACTIVE_REGISTRATION_STATUSES } from "@/domain/padelRegistration";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

async function _GET(req: NextRequest) {
  try {
    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_public_pairings",
      max: 120,
    });
    if (rateLimited) return rateLimited;

    const params = req.nextUrl.searchParams;
    const city = params.get("city")?.trim() ?? "";
    const q = params.get("q")?.trim() ?? "";
    const limit = clampLimit(params.get("limit"));
    const now = new Date();

    const pairingWhere: Prisma.PadelPairingWhereInput = {
      pairingStatus: { not: "CANCELLED" },
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
        { OR: [{ pairingJoinMode: "LOOKING_FOR_PARTNER" }, { isPublicOpen: true }] },
      ],
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
            status: true,
            locationName: true,
            locationCity: true,
            coverImageUrl: true,
            padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
          },
        },
      },
      orderBy: [{ eventId: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    const filtered = pairings.filter((pairing) => {
      const advanced = (pairing.event.padelTournamentConfig?.advancedSettings || {}) as {
        registrationStartsAt?: string | null;
        registrationEndsAt?: string | null;
        competitionState?: string | null;
      };
      const registrationStartsAt =
        advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
          ? new Date(advanced.registrationStartsAt)
          : null;
      const registrationEndsAt =
        advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
          ? new Date(advanced.registrationEndsAt)
          : null;
      const check = checkPadelRegistrationWindow({
        eventStatus: pairing.event.status,
        eventStartsAt: pairing.event.startsAt ?? null,
        registrationStartsAt,
        registrationEndsAt,
        competitionState: advanced.competitionState ?? null,
        lifecycleStatus: pairing.event.padelTournamentConfig?.lifecycleStatus ?? null,
      });
      return check.ok;
    });

    return jsonWrap(
      {
        ok: true,
        items: filtered.map((pairing) => ({
          isExpired: pairing.deadlineAt ? pairing.deadlineAt.getTime() < now.getTime() : false,
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
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
