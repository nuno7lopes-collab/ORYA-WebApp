export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { PadelPairingGuaranteeStatus, PadelRegistrationStatus } from "@prisma/client";
import { queuePairingReminder, queuePairingWindowOpen } from "@/domain/notifications/splitPayments";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

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
          status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
        },
        select: { id: true, title: true, slug: true, timezone: true, organizationId: true },
        take: 120,
      });
      if (events.length === 0) continue;

      const eventIds = events.map((e) => e.id);
      const eventById = new Map(events.map((evt) => [evt.id, evt] as const));
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
            eventId: true,
            deadlineAt: true,
            player1UserId: true,
            player2UserId: true,
            graceUntilAt: true,
          guaranteeStatus: true,
          registration: { select: { status: true } },
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
        const eventMeta = eventById.get(pairing.eventId);
        const eventTitle = eventMeta?.title?.trim() || "Torneio Padel";
        const ctaUrl = eventMeta?.slug ? `/eventos/${eventMeta.slug}` : "/eventos";
        for (const userId of userIds) {
          await queuePairingReminder(pairing.id, userId, { stage: stage.key, deadlineAt });
          notified += 1;
        }

        if (stage.key === "T-48") {
          await queuePairingWindowOpen(pairing.id, Array.from(userIds), deadlineAt);
        }

        if (stage.key === "T-48" || stage.key === "T-24") {
          const message =
            stage.key === "T-48"
              ? "Faltam 48h para confirmar a dupla. Tens 1h para regularizar o split."
              : "Últimas 24h para confirmar a dupla. Se não regularizares, a inscrição será cancelada.";
          await Promise.all(
            Array.from(userIds).map((userId) =>
              queueImportantUpdateEmail({
                dedupeKey: `email:padel:reminder:${stage.key}:${pairing.id}:${userId}`,
                userId,
                eventTitle,
                message,
                ticketUrl: ctaUrl,
                correlations: {
                  eventId: pairing.eventId,
                  organizationId: eventMeta?.organizationId ?? null,
                  pairingId: pairing.id,
                },
              }),
            ),
          );
        }

        if (stage.key === "T-48") {
          const registrationStatus = pairing.registration?.status ?? null;
          if (
            registrationStatus === PadelRegistrationStatus.PENDING_PARTNER ||
            registrationStatus === PadelRegistrationStatus.PENDING_PAYMENT
          ) {
            const graceUntilAt = pairing.graceUntilAt ?? computeGraceUntil(now);
            await prisma.padelPairing.update({
              where: { id: pairing.id },
              data: {
                graceUntilAt,
                guaranteeStatus: PadelPairingGuaranteeStatus.SCHEDULED,
              },
            });
          }
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
