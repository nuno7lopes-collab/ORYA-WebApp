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
import { ensurePadelEventRankingSnapshot } from "@/domain/padel/globalRating";
import { isPublicEventStatus } from "@/domain/events/publicStatus";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

const DEFAULT_LIMIT = 50;
const DEFAULT_RATING = 1200;
const COUNTED_STATUSES = ["OFFICIAL", "WALKOVER", "RETIRED"] as const;

type SnapshotMode = "START" | "CURRENT";

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

const normalizeSnapshotMode = (raw: string | null): SnapshotMode | null => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "START" || normalized === "CURRENT") return normalized;
  return null;
};

function isMissingGlobalRatingSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code ?? null;
  if (code !== "P2021") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return (
    message.includes("padel_global_rating_profiles") ||
    message.includes("padel_global_rating_events") ||
    message.includes("padel_event_ranking_snapshots")
  );
}

function rankingSchemaFallback() {
  return jsonWrap(
    {
      ok: true,
      items: [],
      meta: {
        bootstrap: true,
        reason: "RANKING_SCHEMA_MISSING",
        countedStatuses: COUNTED_STATUSES,
        generatedAt: new Date().toISOString(),
      },
    },
    { status: 200 },
  );
}

function withStablePosition<T extends { points: number }>(rows: T[]): Array<T & { position: number }> {
  let lastPoints: number | null = null;
  let lastPosition = 0;
  return rows.map((row, idx) => {
    if (lastPoints === null || row.points !== lastPoints) {
      lastPoints = row.points;
      lastPosition = idx + 1;
    }
    return { ...row, position: lastPosition };
  });
}

async function ensureUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  return user;
}

async function listEventParticipants(eventId: number) {
  const registered = await prisma.padelTournamentParticipant.findMany({
    where: { eventId },
    select: {
      playerProfileId: true,
      playerProfile: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          displayName: true,
          level: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const deduped = new Map<
    string,
    { userId: string; playerId: number; fullName: string; level: string | null }
  >();
  for (const row of registered) {
    const userId = row.playerProfile?.userId;
    const playerId = row.playerProfile?.id ?? row.playerProfileId;
    if (!userId || !playerId) continue;
    if (deduped.has(userId)) continue;
    deduped.set(userId, {
      userId,
      playerId,
      fullName: row.playerProfile?.displayName || row.playerProfile?.fullName || "Jogador",
      level: row.playerProfile?.level ?? null,
    });
  }
  if (deduped.size > 0) return Array.from(deduped.values());

  const fallbackMatches = await prisma.eventMatchSlot.findMany({
    where: { eventId },
    select: {
      participants: {
        select: {
          participant: {
            select: {
              playerProfileId: true,
              playerProfile: {
                select: {
                  id: true,
                  userId: true,
                  fullName: true,
                  displayName: true,
                  level: true,
                },
              },
            },
          },
        },
      },
    },
  });

  for (const match of fallbackMatches) {
    for (const row of match.participants) {
      const userId = row.participant?.playerProfile?.userId;
      const playerId = row.participant?.playerProfile?.id ?? row.participant?.playerProfileId;
      if (!userId || !playerId) continue;
      if (deduped.has(userId)) continue;
      deduped.set(userId, {
        userId,
        playerId,
        fullName: row.participant?.playerProfile?.displayName || row.participant?.playerProfile?.fullName || "Jogador",
        level: row.participant?.playerProfile?.level ?? null,
      });
    }
  }

  return Array.from(deduped.values());
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
  const periodDaysParam = req.nextUrl.searchParams.get("periodDays");
  const periodDaysRaw = Number(periodDaysParam);
  const periodDays = Number.isFinite(periodDaysRaw) && periodDaysRaw > 0 ? Math.floor(periodDaysRaw) : null;
  const tierFilter = normalizeTierFilter(req.nextUrl.searchParams.get("tier"));
  const cityFilter = normalizeCityFilter(req.nextUrl.searchParams.get("city"));
  const clubIdParam = req.nextUrl.searchParams.get("clubId");
  const clubIdRaw = clubIdParam != null ? Number(clubIdParam) : null;
  const clubIdFilter = clubIdRaw != null && Number.isInteger(clubIdRaw) && clubIdRaw > 0 ? clubIdRaw : null;
  if (clubIdParam != null && clubIdFilter == null) {
    return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  }

  const snapshotModeParam = req.nextUrl.searchParams.get("snapshotMode");
  const snapshotMode = normalizeSnapshotMode(snapshotModeParam);
  if (snapshotModeParam && !snapshotMode) {
    return jsonWrap({ ok: false, error: "INVALID_SNAPSHOT_MODE" }, { status: 400 });
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
        organizationId: true,
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
      isPublicEventStatus(event.status) &&
      competitionState === "PUBLIC";
    if (!isPublicEvent) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const resolvedSnapshotMode = snapshotMode ?? "START";
    const applyPeriodFilter = resolvedSnapshotMode === "CURRENT" && periodDays != null;
    const currentSince = applyPeriodFilter ? since : null;

    if (resolvedSnapshotMode === "START") {
      await ensurePadelEventRankingSnapshot({
        tx: prisma,
        eventId: eId,
        snapshotMode: "START",
      });

      const snapshots = await prisma.padelEventRankingSnapshot.findMany({
        where: {
          eventId: eId,
          snapshotMode: "START",
        },
        include: {
          player: { select: { id: true, fullName: true, level: true } },
          user: { select: { fullName: true } },
        },
        orderBy: [{ points: "desc" }, { userId: "asc" }],
        take: limit,
      });

      const items = withStablePosition(
        snapshots.map((row) => ({
          points: row.points,
          rating: Number(row.rating),
          player: {
            id: row.player?.id ?? row.playerId,
            fullName: row.player?.fullName || row.user?.fullName || "Jogador",
            level: row.player?.level ?? null,
          },
        })),
      ).map((row) => ({
        position: row.position,
        points: row.points,
        rating: row.rating,
        player: row.player,
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
            snapshotMode: resolvedSnapshotMode,
          },
        },
        { status: 200 },
      );
    }

    const participants = await listEventParticipants(eId);
    const participantUserIds = participants.map((row) => row.userId);

    let filteredUsers: Set<string> | null = null;
    if (tierFilter || clubIdFilter || cityFilter || applyPeriodFilter) {
      const rows = await prisma.padelGlobalRatingEvent.findMany({
        where: {
          eventId: eId,
          ...(applyPeriodFilter && currentSince ? { occurredAt: { gte: currentSince } } : {}),
          ...(tierFilter ? { tier: tierFilter } : {}),
          ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
          ...(cityFilter ? { city: cityFilter } : {}),
        },
        select: { userId: true },
        distinct: ["userId"],
        take: 3000,
      });
      filteredUsers = new Set(rows.map((row) => row.userId));
    }

    const profiles = participantUserIds.length
      ? await prisma.padelGlobalRatingProfile.findMany({
          where: {
            userId: { in: participantUserIds },
            ...(currentSince ? { lastActivityAt: { gte: currentSince } } : {}),
          },
          select: {
            userId: true,
            rating: true,
            rd: true,
            sigma: true,
            lastActivityAt: true,
          },
        })
      : [];
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

    const currentRows = participants
      .filter((participant) => (filteredUsers ? filteredUsers.has(participant.userId) : true))
      .map((participant) => {
        const profile = profileMap.get(participant.userId);
        const rating = profile?.rating ?? DEFAULT_RATING;
        return {
          key: participant.userId,
          points: Math.round(rating),
          rating,
          rd: profile?.rd ?? null,
          sigma: profile?.sigma ?? null,
          lastActivityAt: profile?.lastActivityAt ?? null,
          player: {
            id: participant.playerId,
            fullName: participant.fullName,
            level: participant.level ?? null,
          },
        };
      })
      .sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key));

    const leaderRating = currentRows[0]?.rating ?? DEFAULT_RATING;
    const items = withStablePosition(currentRows)
      .slice(0, limit)
      .map((row, idx) => {
        const computed = computeVisualLevel(row.rating, leaderRating);
        let drifted = applyInactivityToVisual(computed, row.lastActivityAt ?? null);
        if (idx === 0) drifted = 1;
        if (idx > 0 && drifted <= 1) drifted = 1.01;
        return {
          position: row.position,
          points: row.points,
          rating: row.rating,
          rd: row.rd,
          sigma: row.sigma,
          player: {
            ...row.player,
            level: row.player.level ?? drifted.toFixed(2),
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
          snapshotMode: resolvedSnapshotMode,
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

    const orgPlayers = await prisma.padelPlayerProfile.findMany({
      where: { organizationId, userId: { not: null } },
      select: { id: true, userId: true, fullName: true, displayName: true, level: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    const playerByUser = new Map<
      string,
      { playerId: number; fullName: string; level: string | null }
    >();
    for (const player of orgPlayers) {
      if (!player.userId || playerByUser.has(player.userId)) continue;
      playerByUser.set(player.userId, {
        playerId: player.id,
        fullName: player.displayName || player.fullName || "Jogador",
        level: player.level ?? null,
      });
    }
    const orgUserIds = Array.from(playerByUser.keys());

    let filteredUsers: Set<string> | null = null;
    if (tierFilter || clubIdFilter || cityFilter) {
      const rows = await prisma.padelGlobalRatingEvent.findMany({
        where: {
          organizationId,
          ...(since ? { occurredAt: { gte: since } } : {}),
          ...(tierFilter ? { tier: tierFilter } : {}),
          ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
          ...(cityFilter ? { city: cityFilter } : {}),
        },
        select: { userId: true },
        distinct: ["userId"],
        take: 5000,
      });
      filteredUsers = new Set(rows.map((row) => row.userId));
    }

    const profiles = orgUserIds.length
      ? await prisma.padelGlobalRatingProfile.findMany({
          where: {
            userId: { in: orgUserIds },
            matchesPlayed: { gt: 0 },
            ...(since ? { lastActivityAt: { gte: since } } : {}),
          },
          select: {
            userId: true,
            rating: true,
            rd: true,
            sigma: true,
            lastActivityAt: true,
          },
        })
      : [];
    const rows = profiles
      .filter((profile) => (filteredUsers ? filteredUsers.has(profile.userId) : true))
      .map((profile) => {
        const player = playerByUser.get(profile.userId);
        if (!player) return null;
        const rating = profile.rating;
        return {
          key: profile.userId,
          points: Math.round(rating),
          rating,
          rd: profile.rd ?? null,
          sigma: profile.sigma ?? null,
          lastActivityAt: profile.lastActivityAt ?? null,
          player,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key));

    const leaderRating = rows[0]?.rating ?? DEFAULT_RATING;
    const items = withStablePosition(rows)
      .slice(0, limit)
      .map((row, idx) => {
        const computed = computeVisualLevel(row.rating, leaderRating);
        let drifted = applyInactivityToVisual(computed, row.lastActivityAt ?? null);
        if (idx === 0) drifted = 1;
        if (idx > 0 && drifted <= 1) drifted = 1.01;
        return {
          position: row.position,
          points: row.points,
          rating: row.rating,
          rd: row.rd,
          sigma: row.sigma,
          player: {
            id: row.player.playerId,
            fullName: row.player.fullName,
            level: row.player.level ?? drifted.toFixed(2),
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

  let filteredUsers: Set<string> | null = null;
  if (tierFilter || clubIdFilter || cityFilter) {
    const rows = await prisma.padelGlobalRatingEvent.findMany({
      where: {
        ...(since ? { occurredAt: { gte: since } } : {}),
        ...(tierFilter ? { tier: tierFilter } : {}),
        ...(clubIdFilter ? { clubId: clubIdFilter } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 10000,
    });
    filteredUsers = new Set(rows.map((row) => row.userId));
  }

  const globalProfiles = await prisma.padelGlobalRatingProfile.findMany({
    where: {
      leaderboardEligible: true,
      matchesPlayed: { gt: 0 },
      ...(since ? { lastActivityAt: { gte: since } } : {}),
      ...(filteredUsers ? { userId: { in: Array.from(filteredUsers) } } : {}),
    },
    select: {
      userId: true,
      rating: true,
      rd: true,
      sigma: true,
      lastActivityAt: true,
    },
    orderBy: [{ rating: "desc" }, { userId: "asc" }],
    take: limit,
  });

  const userIds = globalProfiles.map((row) => row.userId);
  const [profiles, playerProfiles]: [
    Array<{ id: string; fullName: string | null }>,
    Array<{
      id: number;
      userId: string | null;
      fullName: string;
      displayName: string | null;
      level: string | null;
      updatedAt: Date;
    }>,
  ] = userIds.length
    ? await Promise.all([
        prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        }),
        prisma.padelPlayerProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true, userId: true, fullName: true, displayName: true, level: true, updatedAt: true },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        }),
      ])
    : [[], []];

  const profileMap = new Map<string, { id: string; fullName: string | null }>();
  for (const profile of profiles) {
    profileMap.set(profile.id, profile);
  }
  const playerByUser = new Map<string, (typeof playerProfiles)[number]>();
  for (const player of playerProfiles) {
    if (!player.userId || playerByUser.has(player.userId)) continue;
    playerByUser.set(player.userId, player);
  }

  const leaderRating = globalProfiles[0]?.rating ?? DEFAULT_RATING;
  const items = withStablePosition(
    globalProfiles.map((profile) => ({
      points: Math.round(profile.rating),
      rating: profile.rating,
      rd: profile.rd,
      sigma: profile.sigma,
      lastActivityAt: profile.lastActivityAt,
      userId: profile.userId,
    })),
  ).map((row, idx) => {
    const player = playerByUser.get(row.userId);
    const profile = profileMap.get(row.userId);
    const computed = computeVisualLevel(row.rating, leaderRating);
    let drifted = applyInactivityToVisual(computed, row.lastActivityAt ?? null);
    if (idx === 0) drifted = 1;
    if (idx > 0 && drifted <= 1) drifted = 1.01;
      return {
        position: row.position,
        points: row.points,
        rating: row.rating,
        rd: row.rd,
        sigma: row.sigma,
        player: {
          id: player?.id ?? -(idx + 1),
          fullName: profile?.fullName || player?.displayName || player?.fullName || "Jogador",
          level: player?.level ?? drifted.toFixed(2),
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

const safeGet = async (req: NextRequest) => {
  try {
    return await _GET(req);
  } catch (error) {
    if (isMissingGlobalRatingSchemaError(error)) {
      console.warn("[padel/rankings] global rating schema missing; returning bootstrap fallback");
      return rankingSchemaFallback();
    }
    throw error;
  }
};

export const GET = withApiEnvelope(safeGet);
export const POST = withApiEnvelope(_POST);
