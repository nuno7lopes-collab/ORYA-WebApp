export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { queueWaitlistPromoted } from "@/domain/notifications/splitPayments";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";

const MAX_PROMOTIONS_PER_EVENT = 12;

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    type WaitlistConfig = Prisma.PadelTournamentConfigGetPayload<{
      select: {
        eventId: true;
        splitDeadlineHours: true;
        advancedSettings: true;
        event: { select: { startsAt: true; title: true; slug: true; organizationId: true } };
      };
    }>;

    const configs: WaitlistConfig[] = await prisma.padelTournamentConfig.findMany({
      where: {
        padelV2Enabled: true,
        event: {
          isDeleted: false,
          status: { in: ["PUBLISHED", "DATE_CHANGED"] },
        },
      },
      select: {
        eventId: true,
        splitDeadlineHours: true,
        advancedSettings: true,
        event: { select: { startsAt: true, title: true, slug: true, organizationId: true } },
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
      const eventTitle = config.event?.title?.trim() || "Torneio Padel";
      const eventSlug = config.event?.slug ?? null;
      const organizationId = config.event?.organizationId ?? null;

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
          if (organizationId) {
            const ctaUrl = eventSlug ? `/eventos/${eventSlug}` : "/eventos";
            await queueWaitlistPromoted({
              userId: result.userId,
              eventId: config.eventId,
              pairingId: result.pairingId,
              categoryId: null,
            });
            await queueImportantUpdateEmail({
              dedupeKey: `email:padel:waitlist:promoted:${result.entryId}:${result.userId}`,
              userId: result.userId,
              eventTitle,
              message: "A tua inscrição saiu da lista de espera. Conclui o pagamento para garantir a vaga.",
              ticketUrl: ctaUrl,
              correlations: {
                eventId: config.eventId,
                organizationId,
                pairingId: result.pairingId,
              },
            });
          }
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
