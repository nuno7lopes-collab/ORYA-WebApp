import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOfficialEmailVerificationEmail } from "@/lib/emailSender";
import { parseOrganizationId } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import {
  isValidOfficialEmail,
  maskEmailForLog,
  normalizeOfficialEmail,
} from "@/lib/organizationOfficialEmailUtils";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24; // 24h
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
    const organizationId = parseOrganizationId(body?.organizationId);
    const emailNormalized = normalizeOfficialEmail(typeof body?.email === "string" ? body.email : null);
    if (!organizationId || !emailNormalized) {
      return fail(400, "INVALID_PAYLOAD");
    }
    if (!isValidOfficialEmail(emailNormalized)) {
      return fail(400, "INVALID_EMAIL");
    }

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership || membership.role !== OrganizationMemberRole.OWNER) {
      return fail(403, "ONLY_OWNER_CAN_UPDATE_OFFICIAL_EMAIL");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        publicName: true,
        username: true,
      },
    });
    if (!organization) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }

    const currentNormalized = normalizeOfficialEmail(organization.officialEmail ?? null);
    if (organization.officialEmailVerifiedAt && currentNormalized === emailNormalized) {
      return respondOk(
        ctx,
        {
          status: "VERIFIED",
          verifiedAt: organization.officialEmailVerifiedAt,
          email: currentNormalized,
        },
        { status: 200 },
      );
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const request = await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId, status: STATUS_PENDING },
        data: { status: "CANCELLED", cancelledAt: new Date(now) },
      });

      const created = await tx.organizationOfficialEmailRequest.create({
        data: {
          organizationId,
          requestedByUserId: user.id,
          newEmail: emailNormalized,
          token,
          status: STATUS_PENDING,
          expiresAt,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: { officialEmail: emailNormalized, officialEmailVerifiedAt: null },
      });

      const requestedDomain = emailNormalized.split("@")[1] ?? null;
      await recordOrganizationAudit(tx, {
        organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CHANGE_REQUESTED",
        correlationId: ctx.correlationId,
        metadata: {
          email: maskEmailForLog(emailNormalized),
          requestId: created.id,
          verificationMethod: "EMAIL_TOKEN",
          verifiedDomain: requestedDomain,
          requestIdExternal: ctx.requestId,
        },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envia email de verificação (best-effort)
    try {
      const organizationName =
        organization.publicName || organization.username || "Organização ORYA";
      await sendOfficialEmailVerificationEmail({
        to: emailNormalized,
        organizationName,
        token: request.token,
        pendingEmail: emailNormalized,
        expiresAt: request.expiresAt,
        organizationId,
      });
    } catch (emailErr) {
      console.error("[organization/official-email] Falha ao enviar email de verificação", emailErr);
    }

    return respondOk(
      ctx,
      {
        status: request.status,
        expiresAt: request.expiresAt,
        pendingEmail: emailNormalized,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/official-email][POST]", { requestId: ctx.requestId, err });
    return fail(500, "INTERNAL_ERROR");
  }
}
