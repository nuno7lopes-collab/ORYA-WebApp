import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { refundKey } from "@/lib/stripe/idempotency";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
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

    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [{ paymentIntentId }, { purchaseId: paymentIntentId }],
      },
      select: { eventId: true, purchaseId: true, paymentIntentId: true },
    });
    if (!sale) {
      return jsonWrap({ ok: false, error: "SALE_NOT_FOUND" }, { status: 404 });
    }

    const purchaseId = sale.purchaseId ?? sale.paymentIntentId ?? paymentIntentId;
    await enqueueOperation({
      operationType: "PROCESS_REFUND_SINGLE",
      dedupeKey: refundKey(purchaseId),
      correlations: {
        purchaseId,
        paymentIntentId: sale.paymentIntentId ?? paymentIntentId,
        eventId: sale.eventId,
      },
      payload: {
        eventId: sale.eventId,
        purchaseId,
        paymentIntentId: sale.paymentIntentId ?? paymentIntentId,
        reason: "CANCELLED",
        refundedBy: admin.userId,
        auditPayload: { reason: "ADMIN_REFUND" },
      },
    });

    const event = await prisma.event.findUnique({
      where: { id: sale.eventId },
      select: { organizationId: true },
    });
    if (event?.organizationId) {
      await recordOrganizationAuditSafe({
        organizationId: event.organizationId,
        actorUserId: admin.userId,
        action: "ADMIN_PAYMENT_REFUND_REQUEST",
        metadata: {
          paymentIntentId: sale.paymentIntentId ?? paymentIntentId,
          purchaseId,
          reason: "CANCELLED",
        },
      });
    }

    return jsonWrap({ ok: true, queued: true, purchaseId }, { status: 200 });
  } catch (err) {
    console.error("[admin/payments/refund]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);