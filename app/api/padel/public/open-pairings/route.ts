export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { checkPadelRegistrationWindow, INACTIVE_REGISTRATION_STATUSES } from "@/domain/padelRegistration";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { PORTUGAL_CITIES } from "@/config/cities";
import { logError } from "@/lib/observability/logger";

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
    const q = params.get("q")?.trim() ?? "";
    const eventIdParam = params.get("eventId");
    const categoryIdParam = params.get("categoryId");
    const cityParamRaw = params.get("city")?.trim() ?? "";
    const cityParam =
      cityParamRaw && cityParamRaw.toLowerCase() !== "portugal"
        ? PORTUGAL_CITIES.find((entry) => entry.toLowerCase() === cityParamRaw.toLowerCase()) ?? cityParamRaw
        : null;
    const eventId = eventIdParam ? Number(eventIdParam) : null;
    const categoryId = categoryIdParam ? Number(categoryIdParam) : null;
    if (eventIdParam && !Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }
    if (categoryIdParam && !Number.isFinite(categoryId)) {
      return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    }
    const limit = clampLimit(params.get("limit"));
    const now = new Date();
    const eventFilter: Prisma.PadelPairingWhereInput = {};
    if (typeof eventId === "number" && Number.isFinite(eventId)) {
      eventFilter.eventId = eventId;
    }
    const categoryFilter: Prisma.PadelPairingWhereInput = {};
    if (typeof categoryId === "number" && Number.isFinite(categoryId)) {
      categoryFilter.categoryId = categoryId;
    }

    const pairingWhere: Prisma.PadelPairingWhereInput = {
      pairingStatus: { not: "CANCELLED" },
      ...eventFilter,
      ...categoryFilter,
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
        ...(cityParam
          ? {
              addressRef: {
                formattedAddress: { contains: cityParam, mode: Prisma.QueryMode.insensitive },
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { addressRef: { formattedAddress: { contains: q, mode: Prisma.QueryMode.insensitive } } },
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
            addressId: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
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
            locationFormattedAddress: pairing.event.addressRef?.formattedAddress ?? null,
            addressId: pairing.event.addressId ?? null,
            coverImageUrl: pairing.event.coverImageUrl ?? null,
          },
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    logError("api.padel.public.open_pairings", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
