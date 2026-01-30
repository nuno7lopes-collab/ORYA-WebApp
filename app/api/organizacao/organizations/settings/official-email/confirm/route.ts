import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { maskEmailForLog, normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const STATUS_PENDING = "PENDING";

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return fail(400, "INVALID_TOKEN");
    }

    const request = await prisma.organizationOfficialEmailRequest.findUnique({
      where: { token },
    });
    if (!request) {
      return fail(404, "REQUEST_NOT_FOUND");
    }
    if (request.status === "CONFIRMED") {
      const confirmedAt = request.confirmedAt ?? new Date();
      const normalizedEmail = normalizeOfficialEmail(request.newEmail);
      return respondOk(
        ctx,
        {
          status: "VERIFIED",
          verifiedAt: confirmedAt,
          email: normalizedEmail,
        },
        { status: 200 },
      );
    }
    if (request.status !== STATUS_PENDING) {
      return fail(400, "REQUEST_NOT_PENDING");
    }

    const normalizedEmail = normalizeOfficialEmail(request.newEmail);
    if (!normalizedEmail) {
      return fail(400, "INVALID_EMAIL");
    }

    const membership = await resolveGroupMemberForOrg({ organizationId: request.organizationId, userId: user.id });
    if (!membership || membership.role !== OrganizationMemberRole.OWNER) {
      return fail(403, "ONLY_OWNER_CAN_CONFIRM");
    }

    const now = new Date();
    if (request.expiresAt && request.expiresAt.getTime() < now.getTime()) {
      await prisma.organizationOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED", cancelledAt: now },
      });
      return fail(400, "REQUEST_EXPIRED");
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId: request.organizationId, id: { not: request.id }, status: STATUS_PENDING },
        data: { status: "CANCELLED", cancelledAt: now },
      });

      await tx.organization.update({
        where: { id: request.organizationId },
        data: { officialEmail: normalizedEmail, officialEmailVerifiedAt: now },
      });

      const verifiedDomain = normalizedEmail.split("@")[1] ?? null;
      await recordOrganizationAudit(tx, {
        organizationId: request.organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CONFIRMED",
        correlationId: ctx.correlationId,
        metadata: {
          requestId: request.id,
          email: maskEmailForLog(normalizedEmail),
          verificationMethod: "EMAIL_TOKEN",
          verifiedDomain,
          requestIdExternal: ctx.requestId,
        },
        ip,
        userAgent: req.headers.get("user-agent"),
      });
    });

    return respondOk(
      ctx,
      { status: "VERIFIED", verifiedAt: now, email: normalizedEmail },
      { status: 200 },
    );
  } catch (err) {
    console.error("[official-email/confirm][POST]", { requestId: ctx.requestId, err });
    return fail(500, "INTERNAL_ERROR");
  }
}
