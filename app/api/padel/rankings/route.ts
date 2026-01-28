export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { PadelPointsTable } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { resolvePadelMatchStats } from "@/domain/padel/score";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_LIMIT = 50;
const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 200);
};

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
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
  const since = periodDays ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
  const levelFilter = req.nextUrl.searchParams.get("level");
  const cityFilterRaw = req.nextUrl.searchParams.get("city");
  const cityFilter = cityFilterRaw ? cityFilterRaw.trim() : null;

  if (eventId) {
    const eId = Number(eventId);
    if (!Number.isFinite(eId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

    const event = await prisma.event.findUnique({
      where: { id: eId, isDeleted: false },
      select: {
        status: true,
        publicAccessMode: true,
        inviteOnly: true,
        locationCity: true,
        padelTournamentConfig: { select: { advancedSettings: true } },
      },
    });
    if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    });
    const isPublicEvent =
      event.publicAccessMode !== "INVITE" &&
      !event.inviteOnly &&
      ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
      competitionState === "PUBLIC";
    if (!isPublicEvent) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (cityFilter) {
      const eventCity = event.locationCity?.trim().toLowerCase() ?? null;
      if (!eventCity || eventCity !== cityFilter.toLowerCase()) {
        return jsonWrap({ ok: true, items: [] }, { status: 200 });
      }
    }

    const entries = await prisma.padelRankingEntry.findMany({
      where: {
        eventId: eId,
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(levelFilter ? { player: { level: levelFilter } } : {}),
      },
      include: { player: true },
      orderBy: [{ points: "desc" }],
    });
    const items = entries.map((row, idx) => ({
      position: idx + 1,
      points: row.points,
      player: {
        id: row.player.id,
        fullName: row.player.fullName,
        level: row.player.level,
      },
    }));
    return jsonWrap({ ok: true, items }, { status: 200 });
  }

  if (scope === "organization") {
    if (!organizationId) {
      return jsonWrap({ ok: false, error: "MISSING_ORGANIZATION" }, { status: 400 });
    }
    const entries = await prisma.padelRankingEntry.findMany({
      where: {
        organizationId,
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(levelFilter ? { player: { level: levelFilter } } : {}),
        ...(cityFilter
          ? {
              event: {
                locationCity: {
                  equals: cityFilter,
                  mode: "insensitive",
                },
              },
            }
          : {}),
      },
      include: { player: true },
    });

    const aggregated = Object.values(
      entries.reduce<Record<number, { player: any; points: number }>>((acc, row) => {
        const key = row.playerId;
        if (!acc[key]) acc[key] = { player: row.player, points: 0 };
        acc[key].points += row.points;
        return acc;
      }, {}),
    ).sort((a, b) => b.points - a.points);

    const items = aggregated.slice(0, limit).map((item, idx) => ({
      position: idx + 1,
      points: item.points,
      player: {
        id: item.player.id,
        fullName: item.player.fullName,
        level: item.player.level,
      },
    }));

    return jsonWrap({ ok: true, items }, { status: 200 });
  }

  const entries = await prisma.padelRankingEntry.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(levelFilter ? { player: { level: levelFilter } } : {}),
      ...(cityFilter
        ? {
            event: {
              locationCity: {
                equals: cityFilter,
                mode: "insensitive",
              },
            },
          }
        : {}),
    },
    include: { player: true },
  });

  const aggregated = Object.values(
    entries.reduce<Record<number, { player: any; points: number }>>((acc, row) => {
      const key = row.playerId;
      if (!acc[key]) acc[key] = { player: row.player, points: 0 };
      acc[key].points += row.points;
      return acc;
    }, {}),
  ).sort((a, b) => b.points - a.points);

  const items = aggregated.slice(0, limit).map((item, idx) => ({
    position: idx + 1,
    points: item.points,
    player: {
      id: item.player.id,
      fullName: item.player.fullName,
      level: item.player.level,
    },
  }));

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true },
  });
  if (!event || !event.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { ruleSetId: true },
  });
  const ruleSet = config?.ruleSetId
    ? await prisma.padelRuleSet.findUnique({ where: { id: config.ruleSetId } })
    : null;
  const pointsTable: PadelPointsTable = (ruleSet?.pointsTable as any) || { WIN: 3, LOSS: 0 };

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, status: "DONE" },
    include: {
      pairingA: { select: { slots: { select: { playerProfileId: true, profileId: true } } } },
      pairingB: { select: { slots: { select: { playerProfileId: true, profileId: true } } } },
    },
  });

  const profileIds = new Set<string>();
  matches.forEach((m) => {
    [m.pairingA, m.pairingB].forEach((pairing) => {
      pairing?.slots.forEach((slot) => {
        if (!slot.playerProfileId && slot.profileId) profileIds.add(slot.profileId);
      });
    });
  });

  const playerProfiles = profileIds.size
    ? await prisma.padelPlayerProfile.findMany({
        where: { organizationId: event.organizationId!, userId: { in: Array.from(profileIds) } },
        select: { id: true, userId: true },
      })
    : [];
  const profileToPlayerProfile = new Map<string, number>();
  playerProfiles.forEach((row) => {
    if (row.userId) profileToPlayerProfile.set(row.userId, row.id);
  });

  const playerPoints: Record<number, number> = {};
  const winPts = pointsTable.WIN ?? 3;
  const lossPts = pointsTable.LOSS ?? 0;

  const resolvePlayerId = (slot: { playerProfileId: number | null; profileId: string | null }) => {
    if (slot.playerProfileId) return slot.playerProfileId;
    if (slot.profileId) return profileToPlayerProfile.get(slot.profileId) ?? null;
    return null;
  };

  matches.forEach((m) => {
    const scoreObj = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : null;
    const rawSets = Array.isArray(m.scoreSets)
      ? m.scoreSets
      : Array.isArray((scoreObj as { sets?: unknown } | null)?.sets)
        ? ((scoreObj as { sets?: unknown }).sets as any[])
        : null;
    const stats = resolvePadelMatchStats(rawSets, scoreObj);
    let winner: "A" | "B" | null =
      stats?.winner ??
      (scoreObj?.winnerSide === "A" || scoreObj?.winnerSide === "B"
        ? (scoreObj.winnerSide as "A" | "B")
        : null);
    if (!winner) return;
    const winnerPairing = winner === "A" ? m.pairingA : m.pairingB;
    const loserPairing = winner === "A" ? m.pairingB : m.pairingA;

    const award = (pairing: typeof m.pairingA, pts: number) => {
      pairing?.slots.forEach((slot) => {
        const playerId = resolvePlayerId(slot);
        if (!playerId) return;
        playerPoints[playerId] = (playerPoints[playerId] ?? 0) + pts;
      });
    };

    award(winnerPairing, winPts);
    award(loserPairing, lossPts);
  });

  await prisma.$transaction(async (tx) => {
    await tx.padelRankingEntry.deleteMany({ where: { eventId } });
    const sorted = Object.entries(playerPoints)
      .map(([playerIdStr, points]) => ({ playerId: Number(playerIdStr), points }))
      .sort((a, b) => b.points - a.points || a.playerId - b.playerId);
    let lastPoints: number | null = null;
    let lastPosition = 0;
    const entries = sorted.map((row, idx) => {
      if (lastPoints === null || row.points !== lastPoints) {
        lastPosition = idx + 1;
        lastPoints = row.points;
      }
      return {
        organizationId: event.organizationId!,
        eventId,
        playerId: row.playerId,
        points: row.points,
        position: lastPosition,
      };
    });
    if (entries.length > 0) {
      await tx.padelRankingEntry.createMany({ data: entries });
    }
  });

  return jsonWrap({ ok: true }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);