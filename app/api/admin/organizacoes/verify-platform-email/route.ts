import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { maskEmailForLog, normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { OrgType, PendingPayoutStatus } from "@prisma/client";
import { logError } from "@/lib/observability/logger";

type VerifyPlatformEmailBody = {
  organizationId?: number | string;
};

function parseOrganizationId(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  errorCode: string,
  message = errorCode,
  retryable = status >= 500,
) {
  return respondError(ctx, { errorCode, message, retryable }, { status });
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const body = (await req.json().catch(() => null)) as VerifyPlatformEmailBody | null;
    if (!body || typeof body !== "object") {
      return fail(ctx, 400, "INVALID_BODY");
    }

    const organizationId = parseOrganizationId(body.organizationId);
    if (!organizationId) {
      return fail(ctx, 400, "INVALID_FIELDS");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        publicName: true,
        orgType: true,
        stripeAccountId: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
      },
    });

    if (!organization) {
      return fail(ctx, 404, "ORGANIZATION_NOT_FOUND");
    }

    const platformEmail = await getPlatformOfficialEmail();
    const alreadyVerified =
      organization.orgType === OrgType.PLATFORM &&
      normalizeOfficialEmail(organization.officialEmail ?? null) === platformEmail &&
      Boolean(organization.officialEmailVerifiedAt);

    let cancelledPayouts = 0;
    if (organization.orgType !== OrgType.PLATFORM && organization.stripeAccountId) {
      const cancelled = await prisma.pendingPayout.updateMany({
        where: {
          recipientConnectAccountId: organization.stripeAccountId,
          status: {
            in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING, PendingPayoutStatus.BLOCKED],
          },
        },
        data: { status: PendingPayoutStatus.CANCELLED, blockedReason: "ADMIN_PLATFORM_TAKEOVER" },
      });
      cancelledPayouts = cancelled.count;
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        orgType: OrgType.PLATFORM,
        officialEmail: platformEmail,
        officialEmailVerifiedAt: new Date(),
      },
      select: { id: true, orgType: true, officialEmail: true, officialEmailVerifiedAt: true },
    });

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: admin.userId,
      action: "admin_organization_platform_email_verify",
      correlationId: ctx.correlationId,
      metadata: {
        from: {
          orgType: organization.orgType,
          officialEmail: maskEmailForLog(organization.officialEmail),
          officialEmailVerifiedAt: organization.officialEmailVerifiedAt,
        },
        to: {
          orgType: updated.orgType,
          officialEmail: maskEmailForLog(updated.officialEmail),
          officialEmailVerifiedAt: updated.officialEmailVerifiedAt,
        },
        alreadyVerified,
        cancelledPayouts,
      },
      ip,
      userAgent,
    });

    return respondOk(
      ctx,
      {
        organization: {
          id: updated.id,
          orgType: updated.orgType,
          officialEmail: updated.officialEmail,
          officialEmailVerifiedAt: updated.officialEmailVerifiedAt,
        },
        alreadyVerified,
        cancelledPayouts,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("admin.organizacoes.verify_platform_email_failed", err, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
