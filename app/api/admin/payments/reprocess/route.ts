import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as { paymentIntentId?: string } | null;
    const paymentIntentId =
      typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
    if (!paymentIntentId) {
      return jsonWrap({ ok: false, error: "INVALID_PAYMENT_INTENT_ID" }, { status: 400 });
    }

    await enqueueOperation({
      operationType: "FULFILL_PAYMENT",
      dedupeKey: paymentIntentId,
      correlations: { paymentIntentId, purchaseId: paymentIntentId },
      payload: { paymentIntentId },
    });

    await paymentEventRepo(prisma).updateMany({
      where: { purchaseId: paymentIntentId },
      data: { status: "PROCESSING", errorMessage: null, updatedAt: new Date() },
    });

    const sale = await prisma.saleSummary.findFirst({
      where: { OR: [{ paymentIntentId }, { purchaseId: paymentIntentId }] },
      select: { event: { select: { organizationId: true } } },
    });
    if (sale?.event?.organizationId) {
      await recordOrganizationAuditSafe({
        organizationId: sale.event.organizationId,
        actorUserId: admin.userId,
        action: "ADMIN_PAYMENT_REPROCESS",
        metadata: { paymentIntentId },
      });
    }

    return jsonWrap({ ok: true, paymentIntentId }, { status: 200 });
  } catch (err) {
    console.error("[admin/payments/reprocess]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);