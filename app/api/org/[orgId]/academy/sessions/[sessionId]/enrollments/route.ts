import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import {
  ClassEnrollmentError,
  enrollUserIntoClassSession,
} from "@/lib/academy/classEnrollmentService";

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

  const body = await req.json().catch(() => null);
  const payload = isRecord(body) ? body : {};
  const rawUserId = typeof payload.userId === "string"
    ? payload.userId
    : typeof payload.studentId === "string"
      ? payload.studentId
      : null;
  const userId = rawUserId?.trim() || null;
  if (!userId) {
    return respondError(
      access.ctx,
      { errorCode: "STUDENT_REQUIRED", message: "Aluno obrigatório.", retryable: false },
      { status: 400 },
    );
  }

  const partySize = parsePartySize(payload.partySize);
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() || null : null;

  try {
    const txResult = await enrollUserIntoClassSession({
      organizationId: access.organization.id,
      actorUserId: access.profile.id,
      userId,
      source: "BACKOFFICE",
      sessionId,
      partySize,
      addressId,
    });

    const bookingPayload = txResult.booking
      ? {
          id: txResult.booking.id,
          status: txResult.booking.status,
          pendingExpiresAt: txResult.booking.pendingExpiresAt,
        }
      : null;

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
      booking: bookingPayload,
      deduped: txResult.kind === "existing",
    });
  } catch (err) {
    if (err instanceof ClassEnrollmentError) {
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
