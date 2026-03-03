import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

function parseDate(raw: string | null) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parsePositiveInt(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

async function _GET(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const from = parseDate(req.nextUrl.searchParams.get("from"));
  const to = parseDate(req.nextUrl.searchParams.get("to"));
  const classId = parsePositiveInt(req.nextUrl.searchParams.get("classId"));
  const trainerId = parsePositiveInt(req.nextUrl.searchParams.get("trainerId"));
  const now = new Date();
  const startRange = from ?? now;
  const endRange = to ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.classSession.findMany({
    where: {
      organizationId: access.organization.id,
      startsAt: { gte: startRange, lte: endRange },
      service: {
        kind: "CLASS",
        ...(classId ? { id: classId } : {}),
      },
      ...(trainerId ? { professionalId: trainerId } : {}),
    },
    orderBy: [{ startsAt: "asc" }],
    include: {
      service: { select: { id: true, title: true, durationMinutes: true } },
      professional: { select: { id: true, name: true } },
      court: { select: { id: true, name: true } },
    },
  });

  const enrollmentRows = sessions.length
    ? await prisma.academyEnrollment.groupBy({
        by: ["classSessionId"],
        where: {
          organizationId: access.organization.id,
          classSessionId: { in: sessions.map((session) => session.id) },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        _count: { _all: true },
      })
    : [];

  const waitlistRows = sessions.length
    ? await prisma.academyWaitlistEntry.groupBy({
        by: ["classSessionId"],
        where: {
          organizationId: access.organization.id,
          classSessionId: { in: sessions.map((session) => session.id) },
          status: "WAITING",
        },
        _count: { _all: true },
      })
    : [];

  const enrolledCountBySessionId = new Map<number, number>();
  for (const row of enrollmentRows) {
    enrolledCountBySessionId.set(row.classSessionId, row._count._all);
  }

  const waitlistCountBySessionId = new Map<number, number>();
  for (const row of waitlistRows) {
    waitlistCountBySessionId.set(row.classSessionId, row._count._all);
  }

  const items = sessions.map((session) => {
    return {
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
        ? { id: session.professional.id, name: session.professional.name }
        : null,
      court: session.court ? { id: session.court.id, name: session.court.name ?? "Campo" } : null,
      enrolledCount: enrolledCountBySessionId.get(session.id) ?? 0,
      waitlistCount: waitlistCountBySessionId.get(session.id) ?? 0,
    };
  });

  return respondOk(access.ctx, { items });
}

export const GET = withApiEnvelope(_GET);
