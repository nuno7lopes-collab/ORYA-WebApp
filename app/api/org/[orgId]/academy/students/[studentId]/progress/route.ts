import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

const CONFIRMED_BOOKING_STATUSES = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW"]);
const CANCELLED_BOOKING_STATUSES = new Set(["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"]);

function isValidUserId(raw: string) {
  return raw.trim().length >= 8;
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const resolved = await params;
  const studentId = String(resolved.studentId ?? "").trim();
  if (!isValidUserId(studentId)) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Aluno inválido.", retryable: false },
      { status: 400 },
    );
  }

  const [bookings, attendanceRows, studentProfile] = await Promise.all([
    prisma.booking.findMany({
      where: {
        organizationId: access.organization.id,
        userId: studentId,
        service: { kind: "CLASS" },
      },
      select: {
        status: true,
      },
    }),
    prisma.academyAttendance.findMany({
      where: {
        organizationId: access.organization.id,
        userId: studentId,
      },
      select: {
        status: true,
        markedAt: true,
      },
      orderBy: [{ markedAt: "desc" }],
    }),
    prisma.academyStudentProfile.findUnique({
      where: {
        organizationId_userId: {
          organizationId: access.organization.id,
          userId: studentId,
        },
      },
      select: { id: true },
    }),
  ]);

  const bookingsTotal = bookings.length;
  const bookingsConfirmed = bookings.filter((booking) => CONFIRMED_BOOKING_STATUSES.has(booking.status)).length;
  const bookingsCompleted = bookings.filter((booking) => booking.status === "COMPLETED").length;
  const bookingsCancelled = bookings.filter((booking) => CANCELLED_BOOKING_STATUSES.has(booking.status)).length;
  const bookingsNoShow = bookings.filter((booking) => booking.status === "NO_SHOW").length;

  const attendancePresent = attendanceRows.filter((row) => row.status === "PRESENT").length;
  const attendanceAbsent = attendanceRows.filter((row) => row.status === "ABSENT").length;
  const attendanceLate = attendanceRows.filter((row) => row.status === "LATE").length;

  const goals = studentProfile
    ? await prisma.academyStudentGoal.findMany({
        where: {
          organizationId: access.organization.id,
          studentProfileId: studentProfile.id,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          targetDate: true,
        },
      })
    : [];

  const notes = studentProfile
    ? await prisma.academyCoachNote.findMany({
        where: {
          organizationId: access.organization.id,
          studentProfileId: studentProfile.id,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          createdAt: true,
          trainerUserId: true,
          classSessionId: true,
          note: true,
        },
      })
    : [];

  return respondOk(access.ctx, {
    studentId,
    bookings: {
      total: bookingsTotal,
      confirmed: bookingsConfirmed,
      completed: bookingsCompleted,
      cancelled: bookingsCancelled,
      noShow: bookingsNoShow,
    },
    attendance: {
      present: attendancePresent,
      absent: attendanceAbsent,
      late: attendanceLate,
      lastMarkedAt: attendanceRows.length > 0 ? attendanceRows[0].markedAt : null,
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      targetDate: goal.targetDate,
    })),
    latestNotes: notes.map((note) => ({
      id: note.id,
      createdAt: note.createdAt,
      trainerUserId: note.trainerUserId,
      sessionId: note.classSessionId,
      note: note.note,
    })),
  });
}

export const GET = withApiEnvelope(_GET);
