export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const MAX_PROMOTIONS_PER_EVENT = 12;

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const configs = await prisma.padelTournamentConfig.findMany({
      where: {
        padelV2Enabled: true,
        event: {
          isDeleted: false,
          status: { in: ["PUBLISHED", "DATE_CHANGED"] },
          startsAt: { not: null },
        },
      },
      select: {
        eventId: true,
        splitDeadlineHours: true,
        advancedSettings: true,
        event: { select: { startsAt: true } },
      },
    });

    let promoted = 0;
    let processed = 0;
    const errors: Array<{ eventId: number; error: string }> = [];

    for (const config of configs) {
      const advanced = (config.advancedSettings || {}) as { waitlistEnabled?: boolean; maxEntriesTotal?: number | null };
      if (!advanced.waitlistEnabled) continue;
      processed += 1;
      const maxEntriesTotal =
        typeof advanced.maxEntriesTotal === "number" && Number.isFinite(advanced.maxEntriesTotal)
          ? Math.floor(advanced.maxEntriesTotal)
          : null;
      const eventStartsAt = config.event?.startsAt ?? null;

      for (let i = 0; i < MAX_PROMOTIONS_PER_EVENT; i += 1) {
        try {
          const result = await prisma.$transaction((tx) =>
            promoteNextPadelWaitlistEntry({
              tx,
              eventId: config.eventId,
              categoryId: null,
              eventStartsAt,
              splitDeadlineHours: config.splitDeadlineHours ?? undefined,
              maxEntriesTotal,
            }),
          );
          if (!result.ok) {
            break;
          }
          promoted += 1;
        } catch (err) {
          errors.push({ eventId: config.eventId, error: err instanceof Error ? err.message : String(err) });
          break;
        }
      }
    }

    await recordCronHeartbeat("padel-waitlist", {
      status: errors.length ? "ERROR" : "SUCCESS",
      startedAt,
      metadata: { processed, promoted, errors: errors.length },
    });

    return jsonWrap(
      { ok: true, processed, promoted, errors },
      { status: errors.length ? 207 : 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("padel-waitlist", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
