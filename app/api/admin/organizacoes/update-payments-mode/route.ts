import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { OrgType } from "@prisma/client";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

type UpdatePaymentsModeBody = {
  organizationId?: number | string;
  paymentsMode?: string;
};

function parseOrganizationId(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePaymentsMode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "PLATFORM") return OrgType.PLATFORM;
  if (normalized === "CONNECT" || normalized === "EXTERNAL") return OrgType.EXTERNAL;
  return null;
}

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as UpdatePaymentsModeBody | null;
    if (!body || typeof body !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const organizationId = parseOrganizationId(body.organizationId);
    const orgType = parsePaymentsMode(body.paymentsMode);
    if (!organizationId || !orgType) {
      return jsonWrap({ ok: false, error: "INVALID_FIELDS" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, publicName: true, orgType: true, stripeAccountId: true },
    });

    if (!organization) {
      return jsonWrap({ ok: false, error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
    }

    if (organization.orgType === orgType) {
      return jsonWrap({
        ok: true,
        organization: { id: organization.id, orgType: organization.orgType, changed: false },
      });
    }

    let cancelledPayouts = 0;
    let platformEmail: string | null = null;
    if (orgType === OrgType.PLATFORM) {
      platformEmail = await getPlatformOfficialEmail();
      if (!platformEmail) {
        return jsonWrap({ ok: false, error: "PLATFORM_EMAIL_NOT_SET" }, { status: 400 });
      }
    }
    if (orgType === OrgType.PLATFORM && organization.stripeAccountId) {
      cancelledPayouts = 0;
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data:
        orgType === OrgType.PLATFORM
          ? {
              orgType,
              officialEmail: platformEmail,
              officialEmailVerifiedAt: new Date(),
              stripeAccountId: null,
              stripeChargesEnabled: false,
              stripePayoutsEnabled: false,
            }
          : {
              orgType,
              officialEmail: null,
              officialEmailVerifiedAt: null,
              stripeAccountId: null,
              stripeChargesEnabled: false,
              stripePayoutsEnabled: false,
            },
      select: { id: true, orgType: true },
    });

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: admin.userId,
      action: "admin_organization_payments_mode_change",
      metadata: {
        from: organization.orgType,
        to: orgType,
        cancelledPayouts,
      },
      ip,
      userAgent,
    });

    return jsonWrap({
      ok: true,
      organization: { id: updated.id, orgType: updated.orgType },
      cancelledPayouts,
    });
  } catch (err) {
    logError("admin.organizacoes.update_payments_mode_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
