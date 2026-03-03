import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

type AttendanceInput = {
  studentId?: string;
  userId?: string;
  status?: string;
  note?: string | null;
};

const ATTENDANCE_STATUS = new Set(["PRESENT", "ABSENT", "LATE"]);

function parsePositiveInt(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asAttendanceInput(value: unknown): AttendanceInput | null {
  if (!isRecord(value)) return null;
  return {
    studentId: typeof value.studentId === "string" ? value.studentId : undefined,
    userId: typeof value.userId === "string" ? value.userId : undefined,
    status: typeof value.status === "string" ? value.status : undefined,
    note: typeof value.note === "string" ? value.note : value.note == null ? null : undefined,
  };
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
    select: { id: true },
  });

  if (!session) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const rawItems =
    isRecord(body) && Array.isArray(body.items)
      ? body.items
      : isRecord(body) && Array.isArray(body.attendances)
        ? body.attendances
        : [];

  if (rawItems.length === 0) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Sem presenças para registar.", retryable: false },
      { status: 400 },
    );
  }

  const normalized = rawItems
    .map((item) => asAttendanceInput(item))
    .filter((item): item is AttendanceInput => item != null)
    .map((item) => {
      const userId = (item.studentId ?? item.userId ?? "").trim();
      const status = (item.status ?? "").trim().toUpperCase();
      const note = item.note == null ? null : item.note.trim();
      return { userId, status, note };
    });

  if (normalized.length === 0) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Formato inválido de presenças.", retryable: false },
      { status: 400 },
    );
  }

  const invalid = normalized.find((item) => !item.userId || !ATTENDANCE_STATUS.has(item.status));
  if (invalid) {
    return respondError(
      access.ctx,
      {
        errorCode: "BAD_REQUEST",
        message: "Cada presença precisa de aluno e estado válido (PRESENT/ABSENT/LATE).",
        retryable: false,
      },
      { status: 400 },
    );
  }

  const noteWithoutPresence = normalized.find(
    (item) => Boolean(item.note) && item.status !== "PRESENT" && item.status !== "LATE",
  );
  if (noteWithoutPresence) {
    return respondError(
      access.ctx,
      {
        errorCode: "NOTE_REQUIRES_ATTENDANCE",
        message: "Notas pedagógicas exigem presença registada.",
        retryable: false,
      },
      { status: 409 },
    );
  }

  const userIds = Array.from(new Set(normalized.map((item) => item.userId)));
  const enrollments = await prisma.academyEnrollment.findMany({
    where: {
      organizationId: access.organization.id,
      classSessionId: session.id,
      userId: { in: userIds },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { id: true, userId: true },
  });
  const enrollmentByUserId = new Map(
    enrollments
      .filter((enrollment): enrollment is typeof enrollment & { userId: string } =>
        typeof enrollment.userId === "string" && enrollment.userId.length > 0,
      )
      .map((enrollment) => [enrollment.userId, enrollment.id]),
  );

  const upserts = await prisma.$transaction(
    normalized.map((item) =>
      prisma.academyAttendance.upsert({
        where: {
          classSessionId_userId: {
            classSessionId: session.id,
            userId: item.userId,
          },
        },
        create: {
          organizationId: access.organization.id,
          classSessionId: session.id,
          enrollmentId: enrollmentByUserId.get(item.userId) ?? null,
          userId: item.userId,
          status: item.status,
          note: item.note || null,
          markedAt: new Date(),
          markedByUserId: access.profile.id,
        },
        update: {
          enrollmentId: enrollmentByUserId.get(item.userId) ?? null,
          status: item.status,
          note: item.note || null,
          markedAt: new Date(),
          markedByUserId: access.profile.id,
        },
      }),
    ),
  );

  return respondOk(access.ctx, {
    items: upserts.map((row) => ({
      id: row.id,
      sessionId: row.classSessionId,
      studentId: row.userId,
      status: row.status,
      note: row.note,
      markedAt: row.markedAt,
      markedByUserId: row.markedByUserId,
    })),
  });
}

export const POST = withApiEnvelope(_POST);
