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
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";

const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

function buildDateFilter(dateParam: string | null, dayParam: string | null) {
  if (dateParam === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return { gte: startOfDay, lte: endOfDay };
  }
  if (dateParam === "weekend") {
    const now = new Date();
    const day = now.getDay();
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
    return { gte: start, lte: end };
  }
  if (dateParam === "day" && dayParam) {
    const day = new Date(dayParam);
    if (!Number.isNaN(day.getTime())) {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      return { gte: startOfDay, lte: endOfDay };
    }
  }
  return null;
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
    const dateParam = params.get("date");
    const dayParam = params.get("day");
    const levelParam = params.get("level")?.trim() ?? "";
    const paymentModeParam = params.get("paymentMode")?.trim().toUpperCase() ?? "";
    const cityParamRaw = params.get("city")?.trim() ?? "";
    const cityParam =
      cityParamRaw && cityParamRaw.toLowerCase() !== "portugal"
        ? PORTUGAL_CITIES.find((entry) => entry.toLowerCase() === cityParamRaw.toLowerCase()) ?? cityParamRaw
        : null;
    const eventId = eventIdParam ? Number(eventIdParam) : null;
    const categoryId = categoryIdParam ? Number(categoryIdParam) : null;
    const hasValidEventId = typeof eventId === "number" && Number.isInteger(eventId) && eventId > 0;
    const hasValidCategoryId = typeof categoryId === "number" && Number.isInteger(categoryId) && categoryId > 0;
    if (eventIdParam && !hasValidEventId) {
      return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }
    if (categoryIdParam && !hasValidCategoryId) {
      return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    }
    if (paymentModeParam && paymentModeParam !== "FULL" && paymentModeParam !== "SPLIT") {
      return jsonWrap({ ok: false, error: "INVALID_PAYMENT_MODE" }, { status: 400 });
    }
    const limit = clampLimit(params.get("limit"));
    const queryTake = Math.min(limit * 3, 90);
    const now = new Date();
    const dateFilter = buildDateFilter(dateParam, dayParam);
    const startsAtFilter = dateFilter
      ? {
          ...dateFilter,
          gte:
            dateFilter.gte.getTime() < now.getTime() ? now : dateFilter.gte,
        }
      : { gte: now };
    const eventFilter: Prisma.PadelPairingWhereInput = {};
    if (hasValidEventId) {
      eventFilter.eventId = eventId;
    }
    const categoryFilter: Prisma.PadelPairingWhereInput = {};
    if (hasValidCategoryId) {
      categoryFilter.categoryId = categoryId;
    }

    const pairingWhere: Prisma.PadelPairingWhereInput = {
      pairingStatus: { not: "CANCELLED" },
      ...(paymentModeParam ? { payment_mode: paymentModeParam as "FULL" | "SPLIT" } : {}),
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
        startsAt: startsAtFilter,
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
        slots: {
          select: {
            id: true,
            slotStatus: true,
            profile: {
              select: {
                fullName: true,
                username: true,
                avatarUrl: true,
              },
            },
            playerProfile: {
              select: {
                level: true,
              },
            },
          },
        },
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
            accessPolicies: {
              orderBy: { policyVersion: "desc" },
              take: 1,
              select: { mode: true },
            },
          },
        },
      },
      orderBy: [{ eventId: "asc" }, { createdAt: "desc" }],
      take: queryTake,
    });

    const filtered = pairings.filter((pairing) => {
      const accessMode = resolveEventAccessMode(pairing.event.accessPolicies?.[0]);
      if (!isPublicAccessMode(accessMode)) return false;

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

    const levelNeedle = levelParam.toLowerCase();
    const levelFiltered = levelNeedle
      ? filtered.filter((pairing) => {
          const categoryLabel = pairing.category?.label?.toLowerCase() ?? "";
          if (categoryLabel.includes(levelNeedle)) return true;
          return pairing.slots.some((slot) =>
            String(slot.playerProfile?.level ?? "")
              .toLowerCase()
              .includes(levelNeedle),
          );
        })
      : filtered;

    return jsonWrap(
      {
        ok: true,
        items: levelFiltered
          .map((pairing) => ({
            seekingPlayers: pairing.slots
              .filter((slot) => slot.slotStatus === "FILLED")
              .map((slot) => ({
                displayName:
                  slot.profile?.fullName?.trim() ||
                  slot.profile?.username?.trim() ||
                  null,
                username: slot.profile?.username ?? null,
                avatarUrl: slot.profile?.avatarUrl ?? null,
                level: slot.playerProfile?.level ?? null,
              })),
            averageLevel: (() => {
              const levels = pairing.slots
                .map((slot) => slot.playerProfile?.level)
                .filter((value): value is string => Boolean(value))
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value));
              if (levels.length === 0) return null;
              return Number((levels.reduce((acc, cur) => acc + cur, 0) / levels.length).toFixed(2));
            })(),
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
          }))
          .slice(0, limit),
      },
      { status: 200 },
    );
  } catch (err) {
    logError("api.padel.public.open_pairings", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
