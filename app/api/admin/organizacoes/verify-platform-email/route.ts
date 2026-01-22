import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { OrgType, PendingPayoutStatus } from "@prisma/client";

type VerifyPlatformEmailBody = {
  organizationId?: number | string;
};

const PLATFORM_EMAIL = "oryapt@gmail.com";

function parseOrganizationId(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as VerifyPlatformEmailBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const organizationId = parseOrganizationId(body.organizationId);
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_FIELDS" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
    }

    const alreadyVerified =
      organization.orgType === OrgType.PLATFORM &&
      organization.officialEmail?.toLowerCase() === PLATFORM_EMAIL &&
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
        officialEmail: PLATFORM_EMAIL,
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
      metadata: {
        from: {
          orgType: organization.orgType,
          officialEmail: organization.officialEmail,
          officialEmailVerifiedAt: organization.officialEmailVerifiedAt,
        },
        to: {
          orgType: updated.orgType,
          officialEmail: updated.officialEmail,
          officialEmailVerifiedAt: updated.officialEmailVerifiedAt,
        },
        alreadyVerified,
        cancelledPayouts,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      organization: {
        id: updated.id,
        orgType: updated.orgType,
        officialEmail: updated.officialEmail,
        officialEmailVerifiedAt: updated.officialEmailVerifiedAt,
      },
      alreadyVerified,
      cancelledPayouts,
    });
  } catch (err) {
    console.error("[/api/admin/organizacoes/verify-platform-email] Erro inesperado:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
