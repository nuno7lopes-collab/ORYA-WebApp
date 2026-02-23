export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

function emitPadelMetric(metric: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ kind: "padel_metric", metric, ...payload }));
}

async function _GET(req: NextRequest) {
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_public_live",
    max: 180,
  });
  if (rateLimited) return rateLimited;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug")?.trim() || null;
  const hasEventIdParam = eventIdParam !== null;
  const eventIdParsed = hasEventIdParam ? Number(eventIdParam) : null;
  const eventId = eventIdParsed !== null && Number.isInteger(eventIdParsed) && eventIdParsed > 0 ? eventIdParsed : null;
  if (hasEventIdParam && eventId === null) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }
  if (!hasEventIdParam && !slug) {
    return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: eventId !== null ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      templateType: true,
      status: true,
      padelTournamentConfig: {
        select: {
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
  });

  if (!event || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  if (!isPublicEvent) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const live = await buildPadelLiveReadModel({
    eventId: event.id,
    visibility: "public",
  });
  if (!live) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const liveMatches = live.live_now_by_court.flatMap((court) => court.matches);
  const upcomingMatches = live.upcoming_matches_by_player.flatMap((player) => player.matches);
  const latestMatches = live.latest_results_feed;
  const calendarMatches = live.calendar_days.flatMap((day) => day.courts.flatMap((court) => court.matches));
  const allMatches = [...liveMatches, ...upcomingMatches, ...latestMatches, ...calendarMatches];
  const uniqueById = new Map<number, { stream?: { isLive?: boolean } | null }>();
  allMatches.forEach((match) => {
    if (!uniqueById.has(match.id)) {
      uniqueById.set(match.id, match);
    }
  });
  const totalUnique = uniqueById.size;
  const streamLiveCount = Array.from(uniqueById.values()).reduce((count, match) => {
    return match.stream?.isLive === true ? count + 1 : count;
  }, 0);
  emitPadelMetric("publicLivePayloadStreamCoverage", {
    eventId: event.id,
    value: totalUnique > 0 ? streamLiveCount / totalUnique : 0,
    streamLiveCount,
    matchesCount: totalUnique,
  });

  return jsonWrap({ ok: true, ...live }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
