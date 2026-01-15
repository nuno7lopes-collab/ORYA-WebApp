import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { OrgType, PendingPayoutStatus } from "@prisma/client";

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

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as UpdatePaymentsModeBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const organizationId = parseOrganizationId(body.organizationId);
    const orgType = parsePaymentsMode(body.paymentsMode);
    if (!organizationId || !orgType) {
      return NextResponse.json({ ok: false, error: "INVALID_FIELDS" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, publicName: true, orgType: true, stripeAccountId: true },
    });

    if (!organization) {
      return NextResponse.json({ ok: false, error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
    }

    if (organization.orgType === orgType) {
      return NextResponse.json({
        ok: true,
        organization: { id: organization.id, orgType: organization.orgType, changed: false },
      });
    }

    let cancelledPayouts = 0;
    if (orgType === OrgType.PLATFORM && organization.stripeAccountId) {
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
      data: { orgType },
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

    return NextResponse.json({
      ok: true,
      organization: { id: updated.id, orgType: updated.orgType },
      cancelledPayouts,
    });
  } catch (err) {
    console.error("[/api/admin/organizacoes/update-payments-mode] Erro inesperado:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
