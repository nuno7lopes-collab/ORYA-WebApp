import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

const HOLD_MINUTES = 20;

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("X-ORYA-CRON-SECRET");
    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);

    const stale = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
      },
      select: { id: true, availabilityId: true, organizationId: true, serviceId: true, userId: true },
    });

    if (stale.length === 0) {
      return NextResponse.json({ ok: true, cancelled: 0, updatedAvailabilities: 0 });
    }

    const bookingIds = stale.map((b) => b.id);
    const availabilityIds = Array.from(
      new Set(stale.map((b) => b.availabilityId).filter((id): id is number => Number.isFinite(id))),
    );

    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { status: "CANCELLED" },
      });

      for (const booking of stale) {
        await recordOrganizationAudit(tx, {
          organizationId: booking.organizationId,
          actorUserId: null,
          action: "BOOKING_AUTO_CANCELLED",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            userId: booking.userId,
            reason: "PAYMENT_TIMEOUT",
          },
        });
      }
    });

    let updatedAvailabilities = 0;
    for (const availabilityId of availabilityIds) {
      const availability = await prisma.availability.findUnique({
        where: { id: availabilityId },
        select: { id: true, capacity: true, status: true },
      });
      if (!availability || availability.status === "CANCELLED") continue;

      const activeCount = await prisma.booking.count({
        where: { availabilityId, status: { not: "CANCELLED" } },
      });
      if (activeCount < availability.capacity && availability.status === "FULL") {
        await prisma.availability.update({
          where: { id: availabilityId },
          data: { status: "OPEN" },
        });
        updatedAvailabilities += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      cancelled: bookingIds.length,
      updatedAvailabilities,
    });
  } catch (err) {
    console.error("[CRON BOOKINGS CLEANUP]", err);
    return NextResponse.json({ ok: false, error: "Internal cleanup error" }, { status: 500 });
  }
}
