import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

async function _GET(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const professionals = await prisma.reservationProfessional.findMany({
    where: {
      organizationId: access.organization.id,
      userId: access.profile.id,
      isActive: true,
    },
    select: { id: true },
  });

  const professionalIds = professionals.map((professional) => professional.id);
  if (professionalIds.length === 0) {
    return respondOk(access.ctx, {
      trainerUserId: access.profile.id,
      nextSessions: [],
      pendingNotesCount: 0,
      waitingMessagesCount: 0,
    });
  }

  const now = new Date();
  const nextSessions = await prisma.classSession.findMany({
    where: {
      organizationId: access.organization.id,
      professionalId: { in: professionalIds },
      service: { kind: "CLASS" },
      startsAt: { gte: now },
      status: "SCHEDULED",
    },
    orderBy: [{ startsAt: "asc" }],
    take: 20,
    include: {
      service: { select: { id: true, title: true } },
      professional: { select: { id: true, name: true } },
      court: { select: { id: true, name: true } },
    },
  });

  const pendingNotesCount = await prisma.academyAttendance.count({
    where: {
      organizationId: access.organization.id,
      markedByUserId: access.profile.id,
      status: { in: ["PRESENT", "LATE"] },
      note: null,
    },
  });

  return respondOk(access.ctx, {
    trainerUserId: access.profile.id,
    nextSessions: nextSessions.map((session) => ({
      id: session.id,
      classId: session.serviceId,
      classTitle: session.service.title,
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
          }
        : null,
      court: session.court
        ? {
            id: session.court.id,
            name: session.court.name,
          }
        : null,
      enrolledCount: 0,
      waitlistCount: 0,
    })),
    pendingNotesCount,
    waitingMessagesCount: 0,
  });
}

export const GET = withApiEnvelope(_GET);
