import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { cancelBooking, updateBooking } from "@/domain/bookings/commands";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const HOLD_MINUTES = 10;
const COMPLETION_GRACE_HOURS = 2;

async function _GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
    const now = new Date();

    const [stale, legacyStale] = await Promise.all([
      prisma.booking.findMany({
        where: {
          status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
          pendingExpiresAt: { lt: now },
          paymentIntentId: null,
        },
        select: { id: true, organizationId: true, serviceId: true, userId: true },
      }),
      prisma.booking.findMany({
        where: {
          status: "PENDING",
          pendingExpiresAt: null,
          createdAt: { lt: cutoff },
          paymentIntentId: null,
        },
        select: { id: true, organizationId: true, serviceId: true, userId: true },
      }),
    ]);

    const expired = [...stale, ...legacyStale];
    const bookingIds = expired.map((b) => b.id);

    await prisma.$transaction(async (tx) => {
      if (bookingIds.length) {
        for (const booking of expired) {
          await cancelBooking({
            tx,
            bookingId: booking.id,
            organizationId: booking.organizationId,
            actorUserId: null,
            data: { status: "CANCELLED_BY_CLIENT" },
          });
          await recordOrganizationAudit(tx, {
            organizationId: booking.organizationId,
            actorUserId: null,
            action: "BOOKING_AUTO_CANCELLED",
            metadata: {
              bookingId: booking.id,
              serviceId: booking.serviceId,
              userId: booking.userId,
              reason: "PENDING_EXPIRED",
            },
          });
        }
      }
    });

    const completionCutoff = new Date(now.getTime() - COMPLETION_GRACE_HOURS * 60 * 60 * 1000);
    const candidates = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        startsAt: { lt: completionCutoff },
      },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        organizationId: true,
        serviceId: true,
        userId: true,
        price: true,
        currency: true,
      },
    });

    let completed = 0;
    const completedBookings: typeof candidates = [];
    for (const booking of candidates) {
      const endAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      if (endAt.getTime() + COMPLETION_GRACE_HOURS * 60 * 60 * 1000 <= now.getTime()) {
        await updateBooking({
          bookingId: booking.id,
          organizationId: booking.organizationId,
          actorUserId: null,
          data: { status: "COMPLETED" },
        });
        completed += 1;
        completedBookings.push(booking);
      }
    }

    for (const booking of completedBookings) {
      try {
        await ingestCrmInteraction({
          organizationId: booking.organizationId,
          userId: booking.userId,
          type: CrmInteractionType.BOOKING_COMPLETED,
          sourceType: CrmInteractionSource.BOOKING,
          sourceId: String(booking.id),
          occurredAt: now,
          amountCents: booking.price,
          currency: booking.currency,
          metadata: { bookingId: booking.id, serviceId: booking.serviceId },
        });
      } catch (err) {
        console.warn("[cron][bookings] falha ao criar interacao CRM", err);
      }
    }

    return jsonWrap({
      ok: true,
      cancelled: bookingIds.length,
      completed,
    });
  } catch (err) {
    console.error("[CRON BOOKINGS CLEANUP]", err);
    return jsonWrap({ ok: false, error: "Internal cleanup error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);