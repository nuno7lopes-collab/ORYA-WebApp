export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  computePadelStandingsByGroup,
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  type PadelStandingEntityType,
  type PadelStandingRow,
} from "@/domain/padel/standings";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolvePadelRuleSetSnapshotForEvent } from "@/domain/padel/ruleSetSnapshot";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

const REFRESH_MS = 15000;

type TimerStatePayload = {
  status: "IDLE" | "RUNNING" | "STOPPED";
  roundNumber: number;
  durationSeconds: number;
  startedAt: string | null;
  remainingMs: number;
};

function tieBreakRulesForFormat(format: string | null) {
  if (format === "NON_STOP") {
    return normalizePadelTieBreakRules(["POINTS", "HEAD_TO_HEAD", "GAME_DIFFERENCE", "GAMES_FOR", "COIN_TOSS"]);
  }
  if (format === "AMERICANO" || format === "MEXICANO") {
    return normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]);
  }
  return null;
}

function normalizeTimerState(advancedSettings: unknown): TimerStatePayload {
  const raw =
    advancedSettings &&
    typeof advancedSettings === "object" &&
    !Array.isArray(advancedSettings) &&
    typeof (advancedSettings as Record<string, unknown>).nonStopTimerState === "object"
      ? ((advancedSettings as Record<string, unknown>).nonStopTimerState as Record<string, unknown>)
      : null;

  const statusRaw = typeof raw?.status === "string" ? raw.status.trim().toUpperCase() : "IDLE";
  const status = statusRaw === "RUNNING" || statusRaw === "STOPPED" ? statusRaw : "IDLE";
  const roundNumberRaw = typeof raw?.roundNumber === "number" ? raw.roundNumber : Number(raw?.roundNumber);
  const durationRaw = typeof raw?.durationSeconds === "number" ? raw.durationSeconds : Number(raw?.durationSeconds);
  const roundNumber = Number.isFinite(roundNumberRaw) && roundNumberRaw > 0 ? Math.floor(roundNumberRaw) : 1;
  const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : 20 * 60;
  const startedAt = typeof raw?.startedAt === "string" ? raw.startedAt : null;

  let remainingMs = 0;
  if (status === "RUNNING" && startedAt) {
    const started = new Date(startedAt);
    if (!Number.isNaN(started.getTime())) {
      remainingMs = Math.max(0, durationSeconds * 1000 - (Date.now() - started.getTime()));
    }
  }

  return {
    status,
    roundNumber,
    durationSeconds,
    startedAt,
    remainingMs,
  };
}

async function buildLiveStandings(params: {
  eventId: number;
  categoryId: number | null;
  format: string | null;
  matches: Array<{
    id: number;
    pairingAId: number | null;
    pairingBId: number | null;
    scoreSets: unknown;
    score: unknown;
    groupLabel: string | null;
    status: string;
  }>;
}) {
  const { eventId, categoryId, format, matches } = params;
  const entityType: PadelStandingEntityType = format === "AMERICANO" || format === "MEXICANO" ? "PLAYER" : "PAIRING";
  const ruleSnapshot = await resolvePadelRuleSetSnapshotForEvent({ eventId });
  const pointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
  const tieBreakRules =
    tieBreakRulesForFormat(format) ?? normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);
  const drawOrderSeed = `${eventId}:${Number.isFinite(categoryId) ? categoryId : "all"}:${format ?? "UNKNOWN"}`;

  const standingMatches = matches.map((match) => ({
    id: match.id,
    pairingAId: match.pairingAId,
    pairingBId: match.pairingBId,
    scoreSets: match.scoreSets,
    score: match.score,
    groupLabel: match.groupLabel,
    status: match.status,
  }));

  let standingsByGroup: Record<string, PadelStandingRow[]>;
  if (entityType === "PLAYER") {
    const pairingIds = new Set<number>();
    standingMatches.forEach((match) => {
      if (typeof match.pairingAId === "number") pairingIds.add(match.pairingAId);
      if (typeof match.pairingBId === "number") pairingIds.add(match.pairingBId);
    });
    const pairings = pairingIds.size
      ? await prisma.padelPairing.findMany({
          where: { id: { in: Array.from(pairingIds) } },
          select: {
            id: true,
            slots: { select: { playerProfileId: true } },
          },
        })
      : [];
    const pairingPlayers = new Map<number, number[]>();
    pairings.forEach((pairing) => {
      pairingPlayers.set(
        pairing.id,
        pairing.slots
          .map((slot) => slot.playerProfileId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
      );
    });
    standingsByGroup = computePadelStandingsByGroupForPlayers(standingMatches, pairingPlayers, pointsTable, tieBreakRules, {
      drawOrderSeed,
    });
  } else {
    standingsByGroup = computePadelStandingsByGroup(standingMatches, pointsTable, tieBreakRules, {
      drawOrderSeed,
    });
  }

  const rows = Object.entries(standingsByGroup).flatMap(([groupLabel, groupRows]) =>
    groupRows.map((row, idx) => ({
      groupLabel,
      rank: idx + 1,
      entityId: row.entityId,
      pairingId: entityType === "PAIRING" ? row.entityId : null,
      playerId: entityType === "PLAYER" ? row.entityId : null,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      setDiff: row.setDiff,
      gameDiff: row.gameDiff,
      setsFor: row.setsFor,
      setsAgainst: row.setsAgainst,
      gamesFor: row.gamesFor,
      gamesAgainst: row.gamesAgainst,
    })),
  );

  return {
    entityType,
    rows,
    groups: standingsByGroup,
  };
}

async function buildPayload(eventId: number, categoryId?: number | null) {
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const [event, matches] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        status: true,
        padelTournamentConfig: {
          select: {
            format: true,
            advancedSettings: true,
            lifecycleStatus: true,
          },
        },
        accessPolicies: {
          orderBy: { policyVersion: "desc" },
          take: 1,
          select: { mode: true },
        },
      },
    }),
    prisma.eventMatchSlot.findMany({
      where: { eventId, ...matchCategoryFilter },
      include: {
        pairingA: { include: { slots: { include: { playerProfile: true } } } },
        pairingB: { include: { slots: { include: { playerProfile: true } } } },
      },
      orderBy: [
        { roundType: "asc" },
        { groupLabel: "asc" },
        { startTime: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  if (!event) return { error: "EVENT_NOT_FOUND" as const };

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
  if (!isPublicEvent) return { error: "FORBIDDEN" as const };

  const groupMatches = await prisma.eventMatchSlot.findMany({
    where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
    select: {
      id: true,
      pairingAId: true,
      pairingBId: true,
      scoreSets: true,
      score: true,
      groupLabel: true,
      status: true,
    },
  });
  const standings = await buildLiveStandings({
    eventId,
    categoryId: Number.isFinite(categoryId) ? (categoryId as number) : null,
    format: event.padelTournamentConfig?.format ?? null,
    matches: groupMatches,
  });
  const timerState = normalizeTimerState(event.padelTournamentConfig?.advancedSettings ?? null);

  return {
    matches,
    standings,
    timerState,
    serverNow: new Date().toISOString(),
  };
}

async function _GET(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_live",
    identifier: String(eventId),
    max: 30,
  });
  if (rateLimited) return rateLimited;

  const initialPayload = await buildPayload(eventId, Number.isFinite(categoryId) ? categoryId : null);
  if ("error" in initialPayload) {
    const status = initialPayload.error === "EVENT_NOT_FOUND" ? 404 : initialPayload.error === "FORBIDDEN" ? 403 : 400;
    return jsonWrap({ ok: false, error: initialPayload.error }, { status });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const pushPayload = (payload: {
        matches: unknown;
        standings: unknown;
        timerState: unknown;
        serverNow: string;
      }) => {
        controller.enqueue(
          encoder.encode(
            `event: update\ndata: ${JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })}\n\n`,
          ),
        );
      };

      const send = async () => {
        if (closed) return;
        try {
          const payload = await buildPayload(eventId, Number.isFinite(categoryId) ? categoryId : null);
          if ("error" in payload) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(payload)}\n\n`));
            return;
          }
          pushPayload(payload);
        } catch {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "STREAM_ERROR" })}\n\n`),
          );
        }
      };

      pushPayload(initialPayload);
      const interval = setInterval(send, REFRESH_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
export const GET = withApiEnvelope(_GET);
