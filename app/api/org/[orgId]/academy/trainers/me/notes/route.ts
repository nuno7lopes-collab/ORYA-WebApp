import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

function parsePositiveInt(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function _POST(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const studentId =
    typeof body.studentId === "string"
      ? body.studentId.trim()
      : typeof body.userId === "string"
        ? body.userId.trim()
        : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const visibility = typeof body.visibility === "string" ? body.visibility.trim().toUpperCase() : "COACH_ONLY";
  const sessionId = parsePositiveInt(body.sessionId);

  if (!studentId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Aluno inválido.", retryable: false },
      { status: 400 },
    );
  }

  if (!note) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Nota obrigatória.", retryable: false },
      { status: 400 },
    );
  }

  if (!["COACH_ONLY", "STAFF", "STUDENT"].includes(visibility)) {
    return respondError(
      access.ctx,
      {
        errorCode: "BAD_REQUEST",
        message: "Visibilidade inválida. Usa COACH_ONLY, STAFF ou STUDENT.",
        retryable: false,
      },
      { status: 400 },
    );
  }

  let attendanceId: number | null = null;
  if (sessionId) {
    const session = await prisma.classSession.findFirst({
      where: {
        id: sessionId,
        organizationId: access.organization.id,
        service: { kind: "CLASS" },
      },
      select: {
        id: true,
        professional: { select: { userId: true } },
      },
    });

    if (!session) {
      return respondError(
        access.ctx,
        { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
        { status: 404 },
      );
    }

    const attendance = await prisma.academyAttendance.findFirst({
      where: {
        organizationId: access.organization.id,
        classSessionId: session.id,
        userId: studentId,
        status: { in: ["PRESENT", "LATE"] },
      },
      select: { id: true },
    });

    if (!attendance) {
      return respondError(
        access.ctx,
        {
          errorCode: "NOTE_REQUIRES_ATTENDANCE",
          message: "Nota pedagógica exige presença registada na sessão.",
          retryable: false,
        },
        { status: 409 },
      );
    }

    attendanceId = attendance.id;
  }

  const studentProfile = await prisma.academyStudentProfile.upsert({
    where: {
      organizationId_userId: {
        organizationId: access.organization.id,
        userId: studentId,
      },
    },
    create: {
      organizationId: access.organization.id,
      userId: studentId,
      riskStatus: "ACTIVE",
    },
    update: {},
  });

  const created = await prisma.academyCoachNote.create({
    data: {
      organizationId: access.organization.id,
      trainerUserId: access.profile.id,
      studentProfileId: studentProfile.id,
      classSessionId: sessionId ?? null,
      attendanceId,
      visibility,
      note,
    },
  });

  return respondOk(access.ctx, {
    note: {
      id: created.id,
      studentId,
      studentProfileId: created.studentProfileId,
      sessionId: created.classSessionId,
      visibility: created.visibility,
      note: created.note,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
  });
}

export const POST = withApiEnvelope(_POST);
