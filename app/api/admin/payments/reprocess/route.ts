import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";
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
    if (!paymentIntentId.startsWith("pi_")) {
      return respondError(
        ctx,
        { errorCode: "INVALID_PAYMENT_INTENT_ID", message: "PaymentIntent inválido.", retryable: false },
        { status: 400 },
      );
    }

    const paymentEvent = await prisma.paymentEvent.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { purchaseId: true },
    });
    const saleByIntent = await prisma.saleSummary.findFirst({
      where: { paymentIntentId },
      select: { purchaseId: true },
    });
    const purchaseId = paymentEvent?.purchaseId ?? saleByIntent?.purchaseId ?? null;

    await enqueueOperation({
      operationType: "FULFILL_PAYMENT",
      dedupeKey: paymentIntentId,
      correlations: { paymentIntentId, purchaseId },
      payload: { paymentIntentId, purchaseId },
    });

    await paymentEventRepo(prisma).updateMany({
      where: {
        OR: [
          { stripePaymentIntentId: paymentIntentId },
          purchaseId ? { purchaseId } : undefined,
        ].filter(Boolean) as any,
      },
      data: { status: "PROCESSING", errorMessage: null, updatedAt: new Date() },
    });

    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [
          { paymentIntentId },
          purchaseId ? { purchaseId } : undefined,
        ].filter(Boolean) as any,
      },
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

    await auditAdminAction({
      action: "PAYMENT_REPROCESS",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: { paymentIntentId, purchaseId },
    });

    return respondOk(ctx, { paymentIntentId, purchaseId }, { status: 200 });
  } catch (err) {
    logError("admin.payments.reprocess_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
