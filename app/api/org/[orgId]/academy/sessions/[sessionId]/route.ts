import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

function parsePositiveInt(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const resolved = await params;
  const sessionId = parsePositiveInt(resolved.sessionId);
  if (!sessionId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Sessão inválida.", retryable: false },
      { status: 400 },
    );
  }

  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      organizationId: access.organization.id,
      service: { kind: "CLASS" },
    },
    include: {
      service: { select: { id: true, title: true, durationMinutes: true } },
      professional: { select: { id: true, name: true, userId: true } },
      court: { select: { id: true, name: true } },
    },
  });

  if (!session) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
      { status: 404 },
    );
  }

  const [enrollments, attendance, waitlist] = await Promise.all([
    prisma.academyEnrollment.findMany({
      where: {
        organizationId: access.organization.id,
        classSessionId: session.id,
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        bookingId: true,
        userId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.academyAttendance.findMany({
      where: {
        organizationId: access.organization.id,
        classSessionId: session.id,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        note: true,
        markedAt: true,
        markedByUserId: true,
      },
    }),
    prisma.academyWaitlistEntry.findMany({
      where: {
        organizationId: access.organization.id,
        classSessionId: session.id,
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        status: true,
        position: true,
        acceptanceWindowEndsAt: true,
      },
    }),
  ]);

  const userIds = Array.from(
    new Set(
      enrollments
        .map((enrollment) => enrollment.userId)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
    ),
  );

  const profiles = userIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, username: true, avatarUrl: true },
      })
    : [];

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const attendanceMap = new Map(attendance.map((row) => [row.userId, row]));

  return respondOk(access.ctx, {
    session: {
      id: session.id,
      classId: session.service.id,
      classTitle: session.service.title ?? "Aula",
      seriesId: session.seriesId,
      organizationId: session.organizationId,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      capacity: session.capacity,
      status: session.status,
      trainer: session.professional
        ? {
            id: session.professional.id,
            name: session.professional.name,
            userId: session.professional.userId,
          }
        : null,
      court: session.court
        ? {
            id: session.court.id,
            name: session.court.name,
          }
        : null,
      enrolledCount: enrollments.filter((entry) => ["PENDING", "CONFIRMED"].includes(entry.status)).length,
      waitlistCount: waitlist.filter((entry) => entry.status === "WAITING").length,
    },
    enrollments: enrollments.map((enrollment) => {
      const profile = enrollment.userId ? profileMap.get(enrollment.userId) : null;
      const attendanceRow = enrollment.userId ? attendanceMap.get(enrollment.userId) : null;
      return {
        id: enrollment.id,
        bookingId: enrollment.bookingId,
        userId: enrollment.userId,
        status: enrollment.status,
        createdAt: enrollment.createdAt,
        updatedAt: enrollment.updatedAt,
        student: profile
          ? {
              id: profile.id,
              fullName: profile.fullName,
              username: profile.username,
              avatarUrl: profile.avatarUrl,
            }
          : null,
        attendance: attendanceRow
          ? {
              id: attendanceRow.id,
              status: attendanceRow.status,
              note: attendanceRow.note,
              markedAt: attendanceRow.markedAt,
              markedByUserId: attendanceRow.markedByUserId,
            }
          : null,
      };
    }),
    waitlist,
  });
}

export const GET = withApiEnvelope(_GET);
