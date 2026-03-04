import { NextRequest } from "next/server";
import {
  AddressSourceProvider,
  BookingStatus,
  ReservationAssignmentMode,
  ServiceKind,
  ServiceLocationMode,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBooking } from "@/domain/bookings/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

const ACTIVE_ENROLLMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;
const WAITLIST_ACTIVE_STATUSES = ["WAITING", "PROMOTED"] as const;
const PENDING_HOLD_MINUTES = 10;

function parsePositiveInt(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parsePartySize(raw: unknown) {
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class EnrollmentRouteError extends Error {
  status: number;
  errorCode: string;
  retryable: boolean;
  constructor(status: number, errorCode: string, message: string, retryable = false) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.retryable = retryable;
  }
}

function mapAssignmentMode(
  assignmentMode: ReservationAssignmentMode,
  resourceId: number | null,
) {
  if (assignmentMode === ReservationAssignmentMode.RESOURCE_ONLY) {
    return ReservationAssignmentMode.PROFESSIONAL_ONLY;
  }
  if (assignmentMode === ReservationAssignmentMode.PROFESSIONAL_AND_RESOURCE && !resourceId) {
    return ReservationAssignmentMode.PROFESSIONAL_ONLY;
  }
  return assignmentMode;
}

function resolveSessionDurationMinutes(params: {
  startsAt: Date;
  endsAt: Date;
  serviceDurationMinutes: number;
}) {
  const diffMs = params.endsAt.getTime() - params.startsAt.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Number.isFinite(diffMinutes) && diffMinutes > 0) return diffMinutes;
  return params.serviceDurationMinutes;
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
      service: { kind: ServiceKind.CLASS },
    },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      professionalId: true,
      courtId: true,
      service: {
        select: {
          id: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          assignmentMode: true,
          locationMode: true,
          addressId: true,
          organization: { select: { timezone: true, addressId: true } },
        },
      },
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

  const body = await req.json().catch(() => null);
  const payload = isRecord(body) ? body : {};
  const rawUserId = typeof payload.userId === "string"
    ? payload.userId
    : typeof payload.studentId === "string"
      ? payload.studentId
      : null;
  const userId = rawUserId?.trim() || null;
  const partySize = parsePartySize(payload.partySize);
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() || null : null;

  if (userId) {
    const student = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!student) {
      return respondError(
        access.ctx,
        { errorCode: "STUDENT_NOT_FOUND", message: "Aluno não encontrado.", retryable: false },
        { status: 404 },
      );
    }
  }

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const lockKey = `academy_enrollment:${access.organization.id}:${session.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      if (userId) {
        const existingEnrollment = await tx.academyEnrollment.findFirst({
          where: {
            organizationId: access.organization.id,
            classSessionId: session.id,
            userId,
            status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
          },
          select: {
            id: true,
            bookingId: true,
            classSessionId: true,
            userId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (existingEnrollment) {
          return { kind: "existing" as const, enrollment: existingEnrollment };
        }
      }

      const activeEnrollments = await tx.academyEnrollment.count({
        where: {
          organizationId: access.organization.id,
          classSessionId: session.id,
          status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
        },
      });
      if (activeEnrollments >= session.capacity) {
        throw new EnrollmentRouteError(409, "SESSION_FULL", "Sessão sem vagas. Usa a waitlist.");
      }

      const resolvedAddressId =
        addressId ||
        (session.service.locationMode === ServiceLocationMode.FIXED
          ? session.service.addressId ?? session.service.organization?.addressId ?? null
          : null);

      if (session.service.locationMode === ServiceLocationMode.FIXED && !resolvedAddressId) {
        throw new EnrollmentRouteError(400, "LOCATION_REQUIRED", "Morada obrigatória para esta sessão.");
      }
      if (resolvedAddressId) {
        const resolvedAddress = await tx.address.findUnique({
          where: { id: resolvedAddressId },
          select: { sourceProvider: true },
        });
        if (!resolvedAddress) {
          throw new EnrollmentRouteError(400, "LOCATION_REQUIRED", "Morada inválida.");
        }
        if (resolvedAddress.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
          throw new EnrollmentRouteError(400, "LOCATION_REQUIRED", "Morada deve ser Apple Maps.");
        }
      }

      const resourceId = session.courtId
        ? (
            await tx.reservationResource.findFirst({
              where: {
                organizationId: access.organization.id,
                courtId: session.courtId,
                isActive: true,
              },
              select: { id: true },
            })
          )?.id ?? null
        : null;

      const durationMinutes = resolveSessionDurationMinutes({
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        serviceDurationMinutes: session.service.durationMinutes,
      });
      const assignmentMode = mapAssignmentMode(session.service.assignmentMode, resourceId);
      const pendingExpiresAt = new Date(Date.now() + PENDING_HOLD_MINUTES * 60 * 1000);

      const { booking } = await createBooking({
        tx,
        organizationId: access.organization.id,
        actorUserId: access.profile.id,
        data: {
          serviceId: session.service.id,
          organizationId: access.organization.id,
          userId,
          startsAt: session.startsAt,
          durationMinutes,
          price: session.service.unitPriceCents,
          currency: session.service.currency || "EUR",
          status: BookingStatus.PENDING_CONFIRMATION,
          assignmentMode,
          professionalId: session.professionalId,
          resourceId,
          courtId: session.courtId,
          partySize,
          pendingExpiresAt,
          snapshotTimezone: session.service.organization?.timezone || "Europe/Lisbon",
          locationMode: session.service.locationMode,
          addressId: resolvedAddressId,
        },
        select: {
          id: true,
          status: true,
          pendingExpiresAt: true,
        },
      });

      const enrollment = await tx.academyEnrollment.create({
        data: {
          organizationId: access.organization.id,
          academyClassId: session.service.id,
          classSessionId: session.id,
          bookingId: booking.id,
          userId,
          status: "CONFIRMED",
          source: "BACKOFFICE",
          holdExpiresAt: pendingExpiresAt,
          priceCents: session.service.unitPriceCents,
          currency: session.service.currency || "EUR",
        },
        select: {
          id: true,
          bookingId: true,
          classSessionId: true,
          userId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (userId) {
        await tx.academyWaitlistEntry.updateMany({
          where: {
            organizationId: access.organization.id,
            classSessionId: session.id,
            userId,
            status: { in: [...WAITLIST_ACTIVE_STATUSES] },
          },
          data: {
            status: "REMOVED",
            acceptanceWindowEndsAt: null,
          },
        });
      }

      return {
        kind: "created" as const,
        enrollment,
        booking: {
          id: booking.id,
          status: booking.status,
          pendingExpiresAt,
        },
      };
    });

    if (txResult.kind === "existing") {
      return respondOk(access.ctx, {
        enrollment: {
          id: txResult.enrollment.id,
          bookingId: txResult.enrollment.bookingId,
          classSessionId: txResult.enrollment.classSessionId,
          userId: txResult.enrollment.userId,
          status: txResult.enrollment.status,
          createdAt: txResult.enrollment.createdAt,
          updatedAt: txResult.enrollment.updatedAt,
        },
      });
    }

    return respondOk(access.ctx, {
      enrollment: {
        id: txResult.enrollment.id,
        bookingId: txResult.enrollment.bookingId,
        classSessionId: txResult.enrollment.classSessionId,
        userId: txResult.enrollment.userId,
        status: txResult.enrollment.status,
        createdAt: txResult.enrollment.createdAt,
        updatedAt: txResult.enrollment.updatedAt,
      },
      booking: txResult.booking,
    });
  } catch (err) {
    if (err instanceof EnrollmentRouteError) {
      return respondError(
        access.ctx,
        {
          errorCode: err.errorCode,
          message: err.message,
          retryable: err.retryable,
        },
        { status: err.status },
      );
    }
    console.error("POST /api/org/[orgId]/academy/sessions/[sessionId]/enrollments error:", err);
    return respondError(
      access.ctx,
      {
        errorCode: "ENROLLMENT_FAILED",
        message: "Não foi possível inscrever na sessão.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const POST = withApiEnvelope(_POST);
