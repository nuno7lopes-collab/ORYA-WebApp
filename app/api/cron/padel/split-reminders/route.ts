export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { PadelRegistrationStatus } from "@prisma/client";
import { queuePairingReminder } from "@/domain/notifications/splitPayments";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const WINDOW_MINUTES = 30;
const MAX_PAIRINGS = 500;

const STAGES: Array<{ key: string; hoursBeforeStart: number; statuses: PadelRegistrationStatus[] }> = [
  { key: "T-48", hoursBeforeStart: 48, statuses: [PadelRegistrationStatus.PENDING_PARTNER, PadelRegistrationStatus.MATCHMAKING, PadelRegistrationStatus.PENDING_PAYMENT] },
  { key: "T-36", hoursBeforeStart: 36, statuses: [PadelRegistrationStatus.PENDING_PARTNER, PadelRegistrationStatus.MATCHMAKING, PadelRegistrationStatus.PENDING_PAYMENT] },
  { key: "T-24", hoursBeforeStart: 24, statuses: [PadelRegistrationStatus.PENDING_PARTNER, PadelRegistrationStatus.MATCHMAKING, PadelRegistrationStatus.PENDING_PAYMENT] },
  { key: "T-23", hoursBeforeStart: 23, statuses: [PadelRegistrationStatus.EXPIRED] },
];

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const now = new Date();
    let totalPairings = 0;
    let notified = 0;
    let skipped = 0;

    for (const stage of STAGES) {
      const minutesBefore = stage.hoursBeforeStart * 60;
      const windowStart = new Date(now.getTime() + (minutesBefore - WINDOW_MINUTES) * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (minutesBefore + WINDOW_MINUTES) * 60 * 1000);

      const events = await prisma.event.findMany({
        where: {
          templateType: "PADEL",
          isDeleted: false,
          startsAt: { gte: windowStart, lte: windowEnd },
          status: { in: ["PUBLISHED", "DATE_CHANGED"] },
        },
        select: { id: true },
        take: 120,
      });
      if (events.length === 0) continue;

      const eventIds = events.map((e) => e.id);
      const pairings = await prisma.padelPairing.findMany({
        where: {
          eventId: { in: eventIds },
          payment_mode: "SPLIT",
          pairingStatus: { not: "CANCELLED" },
          registration: { status: { in: stage.statuses } },
          ...(stage.key === "T-23" ? { deadlineAt: { lt: now } } : { deadlineAt: { gte: now } }),
        },
        select: {
          id: true,
          deadlineAt: true,
          player1UserId: true,
          player2UserId: true,
          slots: { select: { profileId: true, invitedUserId: true } },
        },
        take: MAX_PAIRINGS,
      });

      totalPairings += pairings.length;

      for (const pairing of pairings) {
        const userIds = new Set<string>();
        if (pairing.player1UserId) userIds.add(pairing.player1UserId);
        if (pairing.player2UserId) userIds.add(pairing.player2UserId);
        pairing.slots.forEach((slot) => {
          if (slot.profileId) userIds.add(slot.profileId);
          if (slot.invitedUserId) userIds.add(slot.invitedUserId);
        });

        if (userIds.size === 0) {
          skipped += 1;
          continue;
        }

        const deadlineAt = pairing.deadlineAt ? pairing.deadlineAt.toISOString() : null;
        for (const userId of userIds) {
          await queuePairingReminder(pairing.id, userId, { stage: stage.key, deadlineAt });
          notified += 1;
        }
      }
    }

    await recordCronHeartbeat("padel-split-reminders", {
      status: "SUCCESS",
      startedAt,
      metadata: { totalPairings, notified, skipped },
    });

    return jsonWrap({ ok: true, totalPairings, notified, skipped }, { status: 200 });
  } catch (err) {
    await recordCronHeartbeat("padel-split-reminders", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
