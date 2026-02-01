export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolvePadelRuleSetSnapshotForEvent } from "@/domain/padel/ruleSetSnapshot";

const REFRESH_MS = 15000;

async function buildPayload(eventId: number, categoryId?: number | null) {
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const [event, matches] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        status: true,
        padelTournamentConfig: {
          select: { ruleSetId: true, advancedSettings: true, lifecycleStatus: true },
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

  const ruleSnapshot = await resolvePadelRuleSetSnapshotForEvent({ eventId });
  const pointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
  const tieBreakRules = normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);

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
  const standingsByGroup = computePadelStandingsByGroup(groupMatches, pointsTable, tieBreakRules);
  const standings = Object.fromEntries(
    Object.entries(standingsByGroup).map(([label, rows]) => [
      label,
      rows.map((row) => ({
        pairingId: row.pairingId,
        points: row.points,
        wins: row.wins,
        losses: row.losses,
        setsFor: row.setsFor,
        setsAgainst: row.setsAgainst,
      })),
    ]),
  );

  return {
    matches,
    standings,
  };
}

async function _GET(req: NextRequest) {
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

      const pushPayload = (payload: { matches: unknown; standings: unknown }) => {
        controller.enqueue(
          encoder.encode(`event: update\ndata: ${JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })}\n\n`),
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
        } catch (err) {
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
