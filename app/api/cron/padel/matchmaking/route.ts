export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { isWithinMatchmakingWindow } from "@/domain/padelDeadlines";
import { matchmakeOpenPairings } from "@/domain/padel/matchmaking";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const now = new Date();
    type MatchmakingConfig = Prisma.PadelTournamentConfigGetPayload<{
      select: {
        eventId: true;
        splitDeadlineHours: true;
        eligibilityType: true;
        event: { select: { startsAt: true } };
      };
    }>;

    const configs: MatchmakingConfig[] = await prisma.padelTournamentConfig.findMany({
      where: {
        padelV2Enabled: true,
        event: {
          isDeleted: false,
          status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
        },
      },
      select: {
        eventId: true,
        splitDeadlineHours: true,
        eligibilityType: true,
        event: { select: { startsAt: true } },
      },
    });

    let processed = 0;
    let matchedTotal = 0;
    let skippedTotal = 0;
    const errors: Array<{ eventId: number; error: string }> = [];

    for (const config of configs) {
      const startsAt = config.event?.startsAt ?? null;
      if (!isWithinMatchmakingWindow(now, startsAt, config.splitDeadlineHours ?? null)) {
        continue;
      }
      processed += 1;
      try {
        const result = await matchmakeOpenPairings({
          eventId: config.eventId,
          categoryId: null,
          eligibilityType: config.eligibilityType,
          now,
        });
        matchedTotal += result.matched;
        skippedTotal += result.skipped;
      } catch (err) {
        errors.push({ eventId: config.eventId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    await recordCronHeartbeat("padel-matchmaking", {
      status: errors.length ? "ERROR" : "SUCCESS",
      startedAt,
      metadata: { processed, matchedTotal, skippedTotal, errors: errors.length },
    });

    return jsonWrap(
      { ok: true, processed, matchedTotal, skippedTotal, errors },
      { status: errors.length ? 207 : 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("padel-matchmaking", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
