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

function extractBooking(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.booking)) return payload.booking;
  if (isRecord(payload.data) && isRecord(payload.data.booking)) return payload.data.booking;
  if (isRecord(payload.result) && isRecord(payload.result.booking)) return payload.result.booking;
  if (isRecord(payload.data) && isRecord(payload.data.data) && isRecord(payload.data.data.booking)) {
    return payload.data.data.booking;
  }
  return null;
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
    include: {
      service: { select: { id: true } },
      professional: { select: { id: true, isActive: true } },
    },
  });
  if (!session) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Sessão não encontrada.", retryable: false },
      { status: 404 },
    );
  }
  if (!session.professionalId || !session.professional?.isActive) {
    return respondError(
      access.ctx,
      {
        errorCode: "CLASS_REQUIRES_ACTIVE_TRAINER",
        message: "Aula sem treinador ativo não pode aceitar inscrições.",
        retryable: false,
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const payload = isRecord(body) ? body : {};
  const userId = typeof payload.userId === "string"
    ? payload.userId
    : typeof payload.studentId === "string"
      ? payload.studentId
      : null;
  const partySize = typeof payload.partySize === "number" ? payload.partySize : undefined;
  const addressId = typeof payload.addressId === "string" ? payload.addressId : undefined;

  const activeEnrollments = await prisma.academyEnrollment.count({
    where: {
      organizationId: access.organization.id,
      classSessionId: session.id,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  if (activeEnrollments >= session.capacity) {
    return respondError(
      access.ctx,
      {
        errorCode: "SESSION_FULL",
        message: "Sessão sem vagas. Usa a waitlist.",
        retryable: false,
      },
      { status: 409 },
    );
  }

  if (userId) {
    const existingEnrollment = await prisma.academyEnrollment.findFirst({
      where: {
        organizationId: access.organization.id,
        classSessionId: session.id,
        userId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { id: true, bookingId: true, status: true, createdAt: true, updatedAt: true },
    });
    if (existingEnrollment) {
      return respondOk(access.ctx, {
        enrollment: {
          id: existingEnrollment.id,
          bookingId: existingEnrollment.bookingId,
          classSessionId: session.id,
          userId,
          status: existingEnrollment.status,
          createdAt: existingEnrollment.createdAt,
          updatedAt: existingEnrollment.updatedAt,
        },
      });
    }
  }

  const legacyUrl = new URL(req.url);
  legacyUrl.pathname = legacyUrl.pathname.replace(
    /\/academy\/sessions\/\d+\/enrollments\/?$/i,
    "/reservas",
  );

  const legacyResponse = await fetch(legacyUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-orya-academy-bridge": "1",
      ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie") as string } : {}),
      ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization") as string } : {}),
    },
    body: JSON.stringify({
      serviceId: session.service.id,
      startsAt: session.startsAt.toISOString(),
      ...(userId ? { userId } : {}),
      ...(typeof partySize === "number" ? { partySize } : {}),
      ...(addressId ? { addressId } : {}),
      ...(session.professionalId ? { professionalId: session.professionalId } : {}),
      ...(session.courtId ? { courtId: session.courtId } : {}),
    }),
  });

  const legacyPayload = await legacyResponse.json().catch(() => null);
  if (!legacyResponse.ok) {
    return respondError(
      access.ctx,
      {
        errorCode: "ENROLLMENT_FAILED",
        message:
          (isRecord(legacyPayload) && typeof legacyPayload.message === "string"
            ? legacyPayload.message
            : "Não foi possível inscrever na sessão."),
        retryable: legacyResponse.status >= 500,
      },
      { status: legacyResponse.status },
    );
  }

  const booking = extractBooking(legacyPayload);
  const bookingId =
    booking && typeof booking.id === "number" && Number.isFinite(booking.id)
      ? Math.floor(booking.id)
      : null;

  if (!bookingId) {
    return respondError(
      access.ctx,
      {
        errorCode: "ENROLLMENT_FAILED",
        message: "Reserva criada sem identificador válido.",
        retryable: false,
      },
      { status: 502 },
    );
  }

  const enrollment = await prisma.academyEnrollment.create({
    data: {
      organizationId: access.organization.id,
      academyClassId: session.service.id,
      classSessionId: session.id,
      bookingId,
      userId,
      status: "CONFIRMED",
    },
  });

  return respondOk(access.ctx, {
    enrollment: {
      id: enrollment.id,
      bookingId: enrollment.bookingId,
      classSessionId: enrollment.classSessionId,
      userId: enrollment.userId,
      status: enrollment.status,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    },
  });
}

export const POST = withApiEnvelope(_POST);
