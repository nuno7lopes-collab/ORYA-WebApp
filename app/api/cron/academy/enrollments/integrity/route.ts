import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { logError, logWarn } from "@/lib/observability/logger";

async function _GET(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();
    const activeBookingStatuses = ["PENDING_CONFIRMATION", "PENDING", "CONFIRMED", "DISPUTED", "NO_SHOW"] as const;

    const classBookings = await prisma.booking.findMany({
      where: {
        startsAt: { gt: now },
        status: { in: [...activeBookingStatuses] as any },
        service: { kind: "CLASS" },
      },
      select: { id: true, organizationId: true },
      take: 5000,
    });
    const bookingIds = classBookings.map((booking) => booking.id);
    const enrollmentsByBooking = bookingIds.length
      ? await prisma.academyEnrollment.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true },
        })
      : [];
    const enrollmentBookingIdSet = new Set(
      enrollmentsByBooking
        .map((row) => row.bookingId)
        .filter((value): value is number => typeof value === "number" && value > 0),
    );
    const bookingsWithoutEnrollment = classBookings.filter((booking) => !enrollmentBookingIdSet.has(booking.id));

    const enrollments = await prisma.academyEnrollment.findMany({
      where: {
        bookingId: { not: null },
        status: { in: ["PENDING", "CONFIRMED"] },
        classSession: {
          startsAt: { gt: now },
        },
      },
      select: {
        id: true,
        bookingId: true,
        organizationId: true,
      },
      take: 5000,
    });
    const enrollmentBookingIds = Array.from(
      new Set(
        enrollments
          .map((enrollment) => enrollment.bookingId)
          .filter((bookingId): bookingId is number => typeof bookingId === "number" && bookingId > 0),
      ),
    );
    const existingBookingRows = enrollmentBookingIds.length
      ? await prisma.booking.findMany({
          where: { id: { in: enrollmentBookingIds } },
          select: { id: true },
        })
      : [];
    const existingBookingIdSet = new Set(existingBookingRows.map((booking) => booking.id));
    const enrollmentsWithoutBooking = enrollments.filter(
      (enrollment) => enrollment.bookingId != null && !existingBookingIdSet.has(enrollment.bookingId),
    );

    const activeEnrollmentCounts = await prisma.academyEnrollment.groupBy({
      by: ["classSessionId"],
      where: { status: { in: ["PENDING", "CONFIRMED"] } },
      _count: { _all: true },
    });
    const sessionIds = activeEnrollmentCounts.map((row) => row.classSessionId);
    const sessions = sessionIds.length
      ? await prisma.classSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, capacity: true, startsAt: true },
        })
      : [];
    const capacityBySession = new Map(sessions.map((session) => [session.id, session.capacity]));
    const overCapacity = activeEnrollmentCounts.filter((row) => {
      const capacity = capacityBySession.get(row.classSessionId);
      return typeof capacity === "number" && row._count._all > capacity;
    });

    if (bookingsWithoutEnrollment.length || enrollmentsWithoutBooking.length || overCapacity.length) {
      logWarn("academy.enrollments.integrity_mismatch", {
        bookingsWithoutEnrollment: bookingsWithoutEnrollment.length,
        enrollmentsWithoutBooking: enrollmentsWithoutBooking.length,
        sessionsOverCapacity: overCapacity.length,
      });
    }

    await recordCronHeartbeat("academy-enrollments-integrity", {
      status: "SUCCESS",
      startedAt,
    });

    return jsonWrap({
      ok: true,
      checks: {
        bookingsWithoutEnrollment: bookingsWithoutEnrollment.length,
        enrollmentsWithoutBooking: enrollmentsWithoutBooking.length,
        sessionsOverCapacity: overCapacity.length,
      },
      samples: {
        bookingsWithoutEnrollment: bookingsWithoutEnrollment.slice(0, 25),
        enrollmentsWithoutBooking: enrollmentsWithoutBooking.slice(0, 25),
        sessionsOverCapacity: overCapacity.slice(0, 25),
      },
    });
  } catch (err) {
    logError("cron.academy.enrollments.integrity_error", err);
    await recordCronHeartbeat("academy-enrollments-integrity", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    return jsonWrap({ ok: false, error: "Internal integrity error" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
