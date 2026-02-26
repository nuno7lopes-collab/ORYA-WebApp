import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { requestUnifiedRefundCase } from "@/lib/refunds/unifiedRefundCase";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { auditAdminAction } from "@/lib/admin/audit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return respondError(
        ctx,
        { errorCode: admin.error, message: admin.error, retryable: false },
        { status: admin.status },
      );
    }

    const body = (await req.json().catch(() => null)) as { paymentIntentId?: string } | null;
    const paymentIntentId =
      typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
    if (!paymentIntentId) {
      return respondError(
        ctx,
        { errorCode: "INVALID_PAYMENT_INTENT_ID", message: "PaymentIntent inválido.", retryable: false },
        { status: 400 },
      );
    }

    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [{ paymentIntentId }, { purchaseId: paymentIntentId }],
      },
      select: { eventId: true, purchaseId: true, paymentIntentId: true },
    });
    if (!sale) {
      return respondError(
        ctx,
        { errorCode: "SALE_NOT_FOUND", message: "Venda não encontrada.", retryable: false },
        { status: 404 },
      );
    }

    const purchaseId = sale.purchaseId ?? sale.paymentIntentId ?? paymentIntentId;
    const refundCase = await requestUnifiedRefundCase({
      policyCause: "ADMIN_MANUAL",
      paymentId: purchaseId,
      paymentIntentId: sale.paymentIntentId ?? paymentIntentId,
      reasonCode: "ADMIN_REFUND",
      requestedBy: admin.userId,
      idempotencyKey: `refund_case:TICKET_ORDER:${purchaseId}:ADMIN_MANUAL`,
      auditPayload: {
        reason: "ADMIN_REFUND",
        source: "ADMIN_PANEL",
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

    await auditAdminAction({
      action: "PAYMENT_REFUND_REQUEST",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        paymentIntentId: sale.paymentIntentId ?? paymentIntentId,
        purchaseId,
        eventId: sale.eventId,
        reason: "CANCELLED",
      },
    });

    return respondOk(
      ctx,
      {
        queued: true,
        purchaseId,
        refundCaseId: refundCase?.id ?? null,
        refundStatus: refundCase?.status ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("admin.payments.refund_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
