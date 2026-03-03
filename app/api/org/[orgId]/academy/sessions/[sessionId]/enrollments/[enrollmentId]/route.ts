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

  const enrollment = await prisma.academyEnrollment.findFirst({
    where: {
      id: enrollmentId,
      classSessionId: sessionId,
      organizationId: access.organization.id,
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (!enrollment) {
    return respondError(
      access.ctx,
      { errorCode: "NOT_FOUND", message: "Inscrição não encontrada.", retryable: false },
      { status: 404 },
    );
  }

  if (enrollment.bookingId) {
    const legacyUrl = new URL(req.url);
    legacyUrl.pathname = `/api/org/${access.organization.id}/reservas/${enrollment.bookingId}/cancel`;
    const cancelResponse = await fetch(legacyUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie") as string } : {}),
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization") as string } : {}),
      },
      body: JSON.stringify({ reason: "Cancelada a partir de Academia." }),
    });
    if (!cancelResponse.ok) {
      const payload = await cancelResponse.json().catch(() => null);
      return respondError(
        access.ctx,
        {
          errorCode: "CANCEL_FAILED",
          message:
            typeof payload?.message === "string"
              ? payload.message
              : "Não foi possível cancelar a reserva associada.",
          retryable: cancelResponse.status >= 500,
        },
        { status: cancelResponse.status },
      );
    }
  }

  const updated = await prisma.academyEnrollment.update({
    where: { id: enrollment.id },
    data: { status: "CANCELLED" },
  });

  const promotedWaitlist = await prisma.$transaction(async (tx) => {
    const candidate = await tx.academyWaitlistEntry.findFirst({
      where: {
        organizationId: access.organization.id,
        classSessionId: sessionId,
        status: "WAITING",
      },
      orderBy: [{ createdAt: "asc" }],
    });
    if (!candidate) return null;

    const acceptanceWindowEndsAt = new Date(Date.now() + 30 * 60 * 1000);
    return tx.academyWaitlistEntry.update({
      where: { id: candidate.id },
      data: {
        status: "PROMOTED",
        acceptanceWindowEndsAt,
        promotedAt: new Date(),
      },
    });
  });

  return respondOk(access.ctx, {
    enrollment: {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    },
    ...(promotedWaitlist
      ? {
          promotedWaitlist: {
            id: promotedWaitlist.id,
            studentId: promotedWaitlist.userId,
            status: promotedWaitlist.status,
            acceptanceWindowEndsAt: promotedWaitlist.acceptanceWindowEndsAt,
          },
        }
      : {}),
  });
}

export const DELETE = withApiEnvelope(_DELETE);
