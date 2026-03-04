import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import {
  cancelBookingByOrganizationInTx,
  runOrganizationBookingCancellationPostActions,
  type OrgBookingCancellationTxResult,
} from "@/lib/reservas/orgBookingCancellation";

function parsePositiveInt(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

class EnrollmentCancelError extends Error {
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

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; enrollmentId: string }> },
) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const resolved = await params;
  const sessionId = parsePositiveInt(resolved.sessionId);
  const enrollmentId = parsePositiveInt(resolved.enrollmentId);
  if (!sessionId || !enrollmentId) {
    return respondError(
      access.ctx,
      { errorCode: "BAD_REQUEST", message: "Inscrição inválida.", retryable: false },
      { status: 400 },
    );
  }

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const lockKey = `academy_enrollment:${access.organization.id}:${sessionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const enrollment = await tx.academyEnrollment.findFirst({
        where: {
          id: enrollmentId,
          classSessionId: sessionId,
          organizationId: access.organization.id,
        },
        select: {
          id: true,
          bookingId: true,
          status: true,
          updatedAt: true,
        },
      });

      if (!enrollment) {
        throw new EnrollmentCancelError(404, "NOT_FOUND", "Inscrição não encontrada.");
      }

      let cancellationResult: OrgBookingCancellationTxResult | null = null;
      if (enrollment.bookingId) {
        cancellationResult = await cancelBookingByOrganizationInTx({
          tx,
          organizationId: access.organization.id,
          bookingId: enrollment.bookingId,
          actorUserId: access.profile.id,
          actorRole: access.membership.role,
          reason: "Cancelada a partir de Academia.",
          auditSource: "ORG",
        });
      }

      const updated =
        enrollment.status === "CANCELLED"
          ? enrollment
          : await tx.academyEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "CANCELLED" },
              select: {
                id: true,
                bookingId: true,
                status: true,
                updatedAt: true,
              },
            });

      const candidate = await tx.academyWaitlistEntry.findFirst({
        where: {
          organizationId: access.organization.id,
          classSessionId: sessionId,
          status: "WAITING",
        },
        orderBy: [{ createdAt: "asc" }],
      });

      const promotedWaitlist = candidate
        ? await tx.academyWaitlistEntry.update({
            where: { id: candidate.id },
            data: {
              status: "PROMOTED",
              acceptanceWindowEndsAt: new Date(Date.now() + 30 * 60 * 1000),
              promotedAt: new Date(),
            },
          })
        : null;

      return {
        updated,
        promotedWaitlist,
        cancellationResult,
      };
    });

    const postActions =
      txResult.cancellationResult != null
        ? await runOrganizationBookingCancellationPostActions({
            prisma,
            result: txResult.cancellationResult,
          })
        : null;

    return respondOk(access.ctx, {
      enrollment: {
        id: txResult.updated.id,
        bookingId: txResult.updated.bookingId,
        status: txResult.updated.status,
        updatedAt: txResult.updated.updatedAt,
      },
      ...(txResult.cancellationResult
        ? {
            booking: {
              id: txResult.cancellationResult.booking.id,
              status: txResult.cancellationResult.booking.status,
            },
          }
        : {}),
      ...(postActions
        ? {
            refundCaseId: postActions.refundCaseId,
            refundStatus: postActions.refundStatus,
            splitRefundCases: postActions.splitRefundCases,
          }
        : {}),
      ...(txResult.promotedWaitlist
        ? {
            promotedWaitlist: {
              id: txResult.promotedWaitlist.id,
              studentId: txResult.promotedWaitlist.userId,
              status: txResult.promotedWaitlist.status,
              acceptanceWindowEndsAt: txResult.promotedWaitlist.acceptanceWindowEndsAt,
            },
          }
        : {}),
    });
  } catch (err) {
    if (err instanceof EnrollmentCancelError) {
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

    if (err instanceof Error) {
      if (err.message === "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED") {
        return respondError(
          access.ctx,
          {
            errorCode: "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            message: "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
            retryable: false,
          },
          { status: 409 },
        );
      }
      if (err.message === "BOOKING_CANCELLATION_NOT_ALLOWED") {
        return respondError(
          access.ctx,
          {
            errorCode: "BOOKING_CANCELLATION_NOT_ALLOWED",
            message: "Já não é possível cancelar esta reserva.",
            retryable: false,
          },
          { status: 400 },
        );
      }
      if (err.message === "BOOKING_NOT_FOUND") {
        return respondError(
          access.ctx,
          {
            errorCode: "BOOKING_NOT_FOUND",
            message: "Reserva associada não encontrada.",
            retryable: false,
          },
          { status: 404 },
        );
      }
      if (err.message === "BOOKING_REFUND_FAILED") {
        return respondError(
          access.ctx,
          {
            errorCode: "BOOKING_REFUND_FAILED",
            message: "Falha ao processar o reembolso da reserva.",
            retryable: true,
          },
          { status: 502 },
        );
      }
    }

    console.error("DELETE /api/org/[orgId]/academy/sessions/[sessionId]/enrollments/[enrollmentId] error:", err);
    return respondError(
      access.ctx,
      {
        errorCode: "CANCEL_FAILED",
        message: "Não foi possível cancelar a inscrição.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const DELETE = withApiEnvelope(_DELETE);
