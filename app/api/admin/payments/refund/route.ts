import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { refundKey } from "@/lib/stripe/idempotency";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

export async function POST(req: NextRequest) {
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

    return respondOk(ctx, { queued: true, purchaseId }, { status: 200 });
  } catch (err) {
    console.error("[admin/payments/refund]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
