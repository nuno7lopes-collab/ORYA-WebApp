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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function _POST(
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
    select: {
      id: true,
      serviceId: true,
      startsAt: true,
      capacity: true,
    },
  });

  if (!session) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const userId =
    isRecord(body) && typeof body.userId === "string"
      ? body.userId.trim()
      : isRecord(body) && typeof body.studentId === "string"
        ? body.studentId.trim()
        : access.profile.id;

  if (!userId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Aluno inválido.", retryable: false },
      { status: 400 },
    );
  }

  const activeEnrollments = await prisma.academyEnrollment.count({
    where: {
      organizationId: access.organization.id,
      classSessionId: session.id,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  if (activeEnrollments < session.capacity) {
    return respondError(
      access.ctx,
      {
        errorCode: "SESSION_HAS_CAPACITY",
        message: "A sessão ainda tem vagas. Reserva direta disponível.",
        retryable: false,
      },
      { status: 409 },
    );
  }

  const waitingCount = await prisma.academyWaitlistEntry.count({
    where: {
      organizationId: access.organization.id,
      classSessionId: session.id,
      status: "WAITING",
    },
  });

  const entry = await prisma.academyWaitlistEntry.upsert({
    where: {
      classSessionId_userId: {
        classSessionId: session.id,
        userId,
      },
    },
    create: {
      organizationId: access.organization.id,
      classSessionId: session.id,
      userId,
      status: "WAITING",
      position: waitingCount + 1,
    },
    update: {
      status: "WAITING",
      position: waitingCount + 1,
      acceptanceWindowEndsAt: null,
      promotedAt: null,
    },
  });

  return respondOk(access.ctx, {
    waitlist: {
      id: entry.id,
      sessionId: entry.classSessionId,
      studentId: entry.userId,
      status: entry.status,
      position: entry.position,
      acceptanceWindowEndsAt: entry.acceptanceWindowEndsAt,
      promotedAt: entry.promotedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
  });
}

export const POST = withApiEnvelope(_POST);
