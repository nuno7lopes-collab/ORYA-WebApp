export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { queueTournamentEve } from "@/domain/notifications/tournament";
import { shouldNotify } from "@/lib/notifications";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
const REMINDER_HOURS = 24;
const WINDOW_MINUTES = 60;
const MAX_EVENTS = 50;

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_HOURS * 60 - WINDOW_MINUTES) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_HOURS * 60 + WINDOW_MINUTES) * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      templateType: "PADEL",
      isDeleted: false,
      startsAt: { gte: windowStart, lte: windowEnd },
      status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
    },
    select: { id: true },
    take: MAX_EVENTS,
  });

  let notified = 0;
  let skipped = 0;

  for (const event of events) {
    const slots = await prisma.padelPairingSlot.findMany({
      where: {
        pairing: { eventId: event.id },
        slotStatus: "FILLED",
        profileId: { not: null },
      },
      select: { profileId: true },
    });

    const uniqueUserIds = Array.from(
      new Set(slots.map((slot) => slot.profileId).filter(Boolean) as string[]),
    );
    const allowed: string[] = [];
    for (const userId of uniqueUserIds) {
      const allow = await shouldNotify(userId, "EVENT_REMINDER").catch(() => false);
      if (allow) allowed.push(userId);
    }

    if (allowed.length === 0) {
      skipped += uniqueUserIds.length;
      continue;
    }

    await queueTournamentEve(allowed, event.id);
    notified += allowed.length;
  }

    await recordCronHeartbeat("padel-tournament-eve", { status: "SUCCESS", startedAt });
    return jsonWrap(
      { ok: true, windowStart, windowEnd, events: events.length, notified, skipped },
      { status: 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("padel-tournament-eve", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
