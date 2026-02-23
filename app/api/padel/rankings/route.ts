export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { applyInactivityToVisual, computeVisualLevel } from "@/domain/padel/ratingEngine";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";
import { executePadelRankingRebuild } from "@/domain/padel/rankingRebuild";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const DEFAULT_LIMIT = 50;
const COUNTED_STATUSES = ["OFFICIAL", "WALKOVER", "RETIRED"] as const;

const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 200);
};

const normalizeTierFilter = (raw: string | null) => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeCityFilter = (raw: string | null) => {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

async function ensureUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  return user;
}

async function _GET(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_rankings",
    max: 120,
  });
  if (rateLimited) return rateLimited;

  const organizationId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const eventId = req.nextUrl.searchParams.get("eventId");
  const scope = (req.nextUrl.searchParams.get("scope") || "global").toLowerCase();
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const periodDaysRaw = Number(req.nextUrl.searchParams.get("periodDays"));
  const periodDays = Number.isFinite(periodDaysRaw) && periodDaysRaw > 0 ? Math.floor(periodDaysRaw) : null;
  const tierFilter = normalizeTierFilter(req.nextUrl.searchParams.get("tier"));
  const cityFilter = normalizeCityFilter(req.nextUrl.searchParams.get("city"));
  const clubIdParam = req.nextUrl.searchParams.get("clubId");
  const clubIdRaw = clubIdParam != null ? Number(clubIdParam) : null;
  const clubIdFilter = clubIdRaw != null && Number.isInteger(clubIdRaw) && clubIdRaw > 0 ? clubIdRaw : null;
  if (clubIdParam != null && clubIdFilter == null) {
    return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  }
  const since = periodDays ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;

  if (eventId) {
    const eId = Number(eventId);
    if (!Number.isInteger(eId) || eId <= 0) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

    const event = await prisma.event.findUnique({
      where: { id: eId, isDeleted: false },
      select: {
        templateType: true,
        status: true,
        padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
        accessPolicies: {
          orderBy: { policyVersion: "desc" },
          take: 1,
          select: { mode: true },
        },
      },
    });
    if (!event || event.templateType !== "PADEL") {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
      lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
    });
    const isPublicEvent =
      isPublicAccessMode(accessMode) &&
      ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
      competitionState === "PUBLIC";
    if (!isPublicEvent) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const filteredPlayerIds =
      tierFilter || clubIdFilter || cityFilter
        ? (
            await prisma.padelRatingEvent.findMany({
              where: {
                eventId: eId,
                ...(since ? { createdAt: { gte: since } } : {}),
                ...(tierFilter ? { tier: tierFilter } : {}),
                ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
                ...(cityFilter ? { city: cityFilter } : {}),
              },
              select: { playerId: true },
              distinct: ["playerId"],
              take: 2000,
            })
          ).map((row) => row.playerId)
        : null;

    const entries = await prisma.padelRankingEntry.findMany({
      where: {
        eventId: eId,
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(filteredPlayerIds ? { playerId: { in: filteredPlayerIds } } : {}),
      },
      include: { player: true },
      orderBy: [{ points: "desc" }, { playerId: "asc" }],
      take: limit,
    });

    const items = entries.map((row, idx) => ({
      position: idx + 1,
      points: row.points,
      rating: row.points,
      player: {
        id: row.player.id,
        fullName: row.player.fullName,
        level: row.level ?? row.player.level,
      },
    }));

    const bootstrap = items.length === 0;
    return jsonWrap(
      {
        ok: true,
        items,
        meta: {
          bootstrap,
          reason: bootstrap ? "NO_RATING_DATA" : null,
          countedStatuses: COUNTED_STATUSES,
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  }

  if (scope === "organization") {
    const user = await ensureUser();
    if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    if (!organizationId) return jsonWrap({ ok: false, error: "MISSING_ORGANIZATION" }, { status: 400 });

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const filteredPlayerIds =
      tierFilter || clubIdFilter || cityFilter
        ? (
            await prisma.padelRatingEvent.findMany({
              where: {
                organizationId,
                ...(since ? { createdAt: { gte: since } } : {}),
                ...(tierFilter ? { tier: tierFilter } : {}),
                ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
                ...(cityFilter ? { city: cityFilter } : {}),
              },
              select: { playerId: true },
              distinct: ["playerId"],
              take: 5000,
            })
          ).map((row) => row.playerId)
        : null;

    const leader = await prisma.padelRatingProfile.aggregate({ _max: { rating: true } });
    const leaderRating = leader._max.rating ?? 1200;

    const profiles = await prisma.padelRatingProfile.findMany({
      where: {
        organizationId,
        ...(since ? { lastActivityAt: { gte: since } } : {}),
        ...(filteredPlayerIds ? { playerId: { in: filteredPlayerIds } } : {}),
      },
      include: {
        player: {
          select: { id: true, fullName: true, level: true },
        },
      },
      orderBy: [{ rating: "desc" }, { playerId: "asc" }],
      take: limit,
    });

    const items = profiles.map((profile, idx) => {
      const computed = computeVisualLevel(profile.rating, leaderRating);
      let drifted = applyInactivityToVisual(computed, profile.lastActivityAt ?? null);
      if (idx === 0) drifted = 1;
      if (idx > 0 && drifted <= 1) drifted = 1.01;
      return {
        position: idx + 1,
        points: Math.round(profile.rating),
        rating: profile.rating,
        rd: profile.rd,
        sigma: profile.sigma,
        player: {
          id: profile.player.id,
          fullName: profile.player.fullName,
          level: drifted.toFixed(2),
        },
      };
    });

    const bootstrap = items.length === 0;
    return jsonWrap(
      {
        ok: true,
        items,
        meta: {
          bootstrap,
          reason: bootstrap ? "NO_RATING_DATA" : null,
          countedStatuses: COUNTED_STATUSES,
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  }

  const leader = await prisma.padelRatingProfile.aggregate({ _max: { rating: true } });
  const leaderRating = leader._max.rating ?? 1200;
  const filteredPlayerIds =
    tierFilter || clubIdFilter || cityFilter
      ? (
          await prisma.padelRatingEvent.findMany({
            where: {
              ...(since ? { createdAt: { gte: since } } : {}),
              ...(tierFilter ? { tier: tierFilter } : {}),
              ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
              ...(cityFilter ? { city: cityFilter } : {}),
            },
            select: { playerId: true },
            distinct: ["playerId"],
            take: 5000,
          })
        ).map((row) => row.playerId)
      : null;

  const profiles = await prisma.padelRatingProfile.findMany({
    where: {
      ...(since ? { lastActivityAt: { gte: since } } : {}),
      leaderboardEligible: true,
      ...(filteredPlayerIds ? { playerId: { in: filteredPlayerIds } } : {}),
    },
    include: {
      player: {
        select: { id: true, fullName: true, level: true },
      },
    },
    orderBy: [{ rating: "desc" }, { playerId: "asc" }],
    take: limit,
  });

  const items = profiles.map((profile, idx) => {
    const computed = computeVisualLevel(profile.rating, leaderRating);
    let drifted = applyInactivityToVisual(computed, profile.lastActivityAt ?? null);
    if (idx === 0) drifted = 1;
    if (idx > 0 && drifted <= 1) drifted = 1.01;
    return {
      position: idx + 1,
      points: Math.round(profile.rating),
      rating: profile.rating,
      rd: profile.rd,
      sigma: profile.sigma,
      player: {
        id: profile.player.id,
        fullName: profile.player.fullName,
        level: drifted.toFixed(2),
      },
    };
  });

  const bootstrap = items.length === 0;
  return jsonWrap(
    {
      ok: true,
      items,
      meta: {
        bootstrap,
        reason: bootstrap ? "NO_RATING_DATA" : null,
        countedStatuses: COUNTED_STATUSES,
        generatedAt: new Date().toISOString(),
      },
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const user = await ensureUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  const outcome = await executePadelRankingRebuild({
    userId: user.id,
    eventId,
    tier: typeof body.tier === "string" ? body.tier : null,
  });
  if (!outcome.ok) return jsonWrap({ ok: false, error: outcome.error }, { status: outcome.status });

  return jsonWrap({ ok: true, result: outcome.result }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
