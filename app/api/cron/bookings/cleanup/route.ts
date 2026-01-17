import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

const HOLD_MINUTES = 10;
const COMPLETION_GRACE_HOURS = 2;

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("X-ORYA-CRON-SECRET");
    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
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
        await tx.booking.updateMany({
          where: { id: { in: bookingIds } },
          data: { status: "CANCELLED_BY_CLIENT" },
        });

        for (const booking of expired) {
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
      select: { id: true, startsAt: true, durationMinutes: true, organizationId: true, serviceId: true },
    });

    let completed = 0;
    for (const booking of candidates) {
      const endAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      if (endAt.getTime() + COMPLETION_GRACE_HOURS * 60 * 60 * 1000 <= now.getTime()) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED" },
        });
        completed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      cancelled: bookingIds.length,
      completed,
    });
  } catch (err) {
    console.error("[CRON BOOKINGS CLEANUP]", err);
    return NextResponse.json({ ok: false, error: "Internal cleanup error" }, { status: 500 });
  }
}
