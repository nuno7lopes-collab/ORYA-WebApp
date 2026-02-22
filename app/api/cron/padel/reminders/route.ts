export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shouldNotify } from "@/lib/notifications";
import { queueMatchChanged } from "@/domain/notifications/tournament";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
const REMINDER_MINUTES = 15;
const WINDOW_MINUTES = 10;
const MAX_MATCHES = 120;

function emitPadelMetric(metric: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ kind: "padel_metric", metric, ...payload }));
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_MINUTES - WINDOW_MINUTES) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_MINUTES + WINDOW_MINUTES) * 60 * 1000);

  const matches = (await prisma.eventMatchSlot.findMany({
    where: {
      status: "PENDING",
      pairingAId: { not: null },
      pairingBId: { not: null },
      OR: [
        { plannedStartAt: { gte: windowStart, lte: windowEnd } },
        { startTime: { gte: windowStart, lte: windowEnd } },
      ],
    },
    take: MAX_MATCHES,
    include: {
      event: { select: { id: true, title: true, slug: true, organizationId: true, timezone: true } },
      court: { select: { name: true } },
      pairingA: {
        select: {
          id: true,
          slots: {
            select: {
              invitedContact: true,
              profile: { select: { id: true, fullName: true, username: true } },
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
      pairingB: {
        select: {
          id: true,
          slots: {
            select: {
              invitedContact: true,
              profile: { select: { id: true, fullName: true, username: true } },
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
    },
  })) as Prisma.EventMatchSlotGetPayload<{
    include: {
      event: { select: { id: true; title: true; slug: true; organizationId: true; timezone: true } };
      court: { select: { name: true } };
      pairingA: {
        select: {
          id: true;
          slots: {
            select: {
              invitedContact: true;
              profile: { select: { id: true; fullName: true; username: true } };
              playerProfile: { select: { displayName: true; fullName: true } };
            };
          };
        };
      };
      pairingB: {
        select: {
          id: true;
          slots: {
            select: {
              invitedContact: true;
              profile: { select: { id: true; fullName: true; username: true } };
              playerProfile: { select: { displayName: true; fullName: true } };
            };
          };
        };
      };
    };
  }>[];

  let sent = 0;
  let skipped = 0;

  const notifyCache = new Map<string, boolean>();

  for (const match of matches) {
    const startAt = match.plannedStartAt ?? match.startTime;
    if (!startAt) {
      skipped += 1;
      continue;
    }

    const participants = new Set<string>();
    (match.pairingA?.slots ?? []).forEach((slot) => {
      if (slot.profile?.id) participants.add(slot.profile.id);
    });
    (match.pairingB?.slots ?? []).forEach((slot) => {
      if (slot.profile?.id) participants.add(slot.profile.id);
    });

    for (const userId of participants) {
      const allow =
        notifyCache.get(userId) ?? (await shouldNotify(userId, "EVENT_REMINDER").catch(() => false));
      notifyCache.set(userId, allow);
      if (!allow) {
        skipped += 1;
        continue;
      }

      await queueMatchChanged({
        userIds: [userId],
        matchId: match.id,
        startAt,
        courtId: match.courtId ?? null,
        scheduleVersion: match.updatedAt?.toISOString?.() ?? null,
        eventType: "MATCH_STARTING_SOON",
        scheduledAt: startAt,
        priority: "CRITICAL",
      });
      sent += 1;
    }
  }

    emitPadelMetric("matchStartingSoonSentCount", {
      value: sent,
      skipped,
      matches: matches.length,
      reminderMinutes: REMINDER_MINUTES,
      windowMinutes: WINDOW_MINUTES,
    });

    await recordCronHeartbeat("padel-reminders", { status: "SUCCESS", startedAt });
    return jsonWrap(
      { ok: true, windowStart, windowEnd, sent, skipped, matches: matches.length },
      { status: 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("padel-reminders", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
