import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import {
  backfillPadelRatingEventContextForEvent,
  rebuildPadelRatingsForEvent,
} from "@/domain/padel/ratingEngine";
import { rebuildPadelPlayerHistoryProjectionForEvent } from "@/domain/padel/playerHistoryProjection";

const parseBool = (value: string | null) => value === "true" || value === "1";
const parseNumber = (value: string | null) => {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const clampLimit = (value: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.min(Math.max(Math.floor(value), 1), 200);
};

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const apply = parseBool(params.get("apply"));
  const eventId = parseNumber(params.get("eventId"));
  const cursor = parseNumber(params.get("cursor"));
  const limit = clampLimit(parseNumber(params.get("limit")));
  const completedOnly = params.get("completedOnly") ? parseBool(params.get("completedOnly")) : true;
  const backfillRatingContext = params.get("backfillRatingContext")
    ? parseBool(params.get("backfillRatingContext"))
    : true;
  const rebuildHistoryProjection = params.get("rebuildHistoryProjection")
    ? parseBool(params.get("rebuildHistoryProjection"))
    : true;
  const rebuildMissingRatings = parseBool(params.get("rebuildMissingRatings"));

  const events = await prisma.event.findMany({
    where: {
      isDeleted: false,
      templateType: "PADEL",
      organizationId: { not: null },
      ...(eventId ? { id: eventId } : {}),
      ...(!eventId && cursor ? { id: { gt: cursor } } : {}),
      ...(completedOnly
        ? {
            padelTournamentConfig: {
              is: {
                lifecycleStatus: "COMPLETED",
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          lifecycleStatus: true,
        },
      },
    },
    orderBy: { id: "asc" },
    ...(eventId ? {} : { take: limit }),
  });

  const rows: Array<Record<string, unknown>> = [];
  let ratingContextUpdatedTotal = 0;
  let historyRowsTotal = 0;
  let ratingsRebuiltTotal = 0;
  let eventErrors = 0;

  for (const event of events) {
    const organizationId = event.organizationId;
    if (organizationId == null) continue;

    const [ratingEvents, ratingEventsMissingContext, historyRows, doneMatches] = await Promise.all([
      prisma.padelRatingEvent.count({ where: { eventId: event.id } }),
      prisma.padelRatingEvent.count({
        where: {
          eventId: event.id,
          OR: [{ tier: null }, { clubId: null }, { city: null }],
        },
      }),
      prisma.padelPlayerHistoryProjection.count({ where: { eventId: event.id } }),
      prisma.eventMatchSlot.count({
        where: {
          eventId: event.id,
          status: "DONE",
        },
      }),
    ]);

    let contextBackfill: Record<string, unknown> | null = null;
    let ratingRebuild: Record<string, unknown> | null = null;
    let historyRebuild: Record<string, unknown> | null = null;
    let error: string | null = null;

    if (apply) {
      try {
        if (backfillRatingContext) {
          const result = await prisma.$transaction((tx) =>
            backfillPadelRatingEventContextForEvent({
              tx,
              organizationId,
              eventId: event.id,
            }),
          );
          contextBackfill = result;
          if (result.ok) ratingContextUpdatedTotal += result.updated;
        }

        if (rebuildMissingRatings && doneMatches > 0 && ratingEvents === 0) {
          const result = await prisma.$transaction((tx) =>
            rebuildPadelRatingsForEvent({
              tx,
              organizationId,
              eventId: event.id,
              actorUserId: null,
            }),
          );
          ratingRebuild = result;
          ratingsRebuiltTotal += result.rankingRows;
        }

        if (rebuildHistoryProjection) {
          const result = await prisma.$transaction((tx) =>
            rebuildPadelPlayerHistoryProjectionForEvent({
              tx,
              organizationId,
              eventId: event.id,
            }),
          );
          historyRebuild = result;
          if (result.ok) historyRowsTotal += result.rows;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "BACKFILL_FAILED";
        eventErrors += 1;
      }
    }

    rows.push({
      eventId: event.id,
      organizationId,
      slug: event.slug,
      title: event.title,
      lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
      ratingEvents,
      ratingEventsMissingContext,
      historyRows,
      doneMatches,
      ...(contextBackfill ? { contextBackfill } : {}),
      ...(ratingRebuild ? { ratingRebuild } : {}),
      ...(historyRebuild ? { historyRebuild } : {}),
      ...(error ? { error } : {}),
    });
  }

  const nextCursor = eventId ? null : events.length > 0 ? events[events.length - 1]!.id : null;

  return jsonWrap(
    {
      ok: true,
      apply,
      options: {
        completedOnly,
        backfillRatingContext,
        rebuildHistoryProjection,
        rebuildMissingRatings,
      },
      processed: rows.length,
      nextCursor,
      totals: {
        ratingContextUpdated: ratingContextUpdatedTotal,
        historyRowsRebuilt: historyRowsTotal,
        rankingRowsRebuilt: ratingsRebuiltTotal,
        eventErrors,
      },
      rows,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
