export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { retrieveStripeAccount } from "@/domain/finance/gateway/stripeGateway";
import { auditAdminAction } from "@/lib/admin/audit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

type RefreshPayload = {
  organizationId?: number;
};

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const payload = (await req.json().catch(() => null)) as RefreshPayload | null;
    const organizationId = typeof payload?.organizationId === "number" ? payload.organizationId : null;
    if (!organizationId || !Number.isFinite(organizationId)) {
      return jsonWrap({ ok: false, error: "INVALID_ORG_ID" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, orgType: true, stripeAccountId: true },
    });

    if (!organization) {
      return jsonWrap({ ok: false, error: "ORG_NOT_FOUND" }, { status: 404 });
    }

    if (organization.orgType === "PLATFORM") {
      return jsonWrap({
        ok: true,
        status: "PLATFORM",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
        accountId: null,
      });
    }

    if (!organization.stripeAccountId) {
      return jsonWrap({
        ok: true,
        status: "NOT_CONNECTED",
        charges_enabled: false,
        payouts_enabled: false,
        requirements_due: [],
        accountId: null,
      });
    }

    const account = await retrieveStripeAccount(organization.stripeAccountId);
    const charges_enabled = account.charges_enabled ?? false;
    const payouts_enabled = account.payouts_enabled ?? false;
    const requirements_due = account.requirements?.currently_due ?? [];

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeAccountId: account.id,
        stripeChargesEnabled: charges_enabled,
        stripePayoutsEnabled: payouts_enabled,
      },
    });

    const status =
      charges_enabled && payouts_enabled && (!requirements_due || requirements_due.length === 0)
        ? "CONNECTED"
        : "INCOMPLETE";

    await auditAdminAction({
      action: "ORGANIZATION_REFRESH_PAYMENTS_STATUS",
      actorUserId: admin.userId,
      payload: {
        organizationId: organization.id,
        status,
        charges_enabled,
        payouts_enabled,
        requirements_due,
        accountId: account.id,
      },
    });

    return jsonWrap({
      ok: true,
      status,
      charges_enabled,
      payouts_enabled,
      requirements_due,
      accountId: account.id,
    });
  } catch (err) {
    logError("admin.organizacoes.refresh_payments_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
