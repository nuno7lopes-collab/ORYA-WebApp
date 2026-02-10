import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { auditAdminAction } from "@/lib/admin/audit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return respondError(
      ctx,
      { errorCode: admin.error, message: admin.error, retryable: false },
      { status: admin.status },
    );
  }

  const body = await req.json().catch(() => ({}));
  const saleSummaryId = Number(body?.saleSummaryId);
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!Number.isFinite(saleSummaryId)) {
    return respondError(
      ctx,
      { errorCode: "INVALID_ID", message: "ID inválido.", retryable: false },
      { status: 400 },
    );
  }

  try {
    const sale = await prisma.saleSummary.findUnique({
      where: { id: saleSummaryId },
      select: { purchaseId: true, paymentIntentId: true },
    });
    if (!sale) {
      return respondError(
        ctx,
        { errorCode: "NOT_FOUND", message: "Venda não encontrada.", retryable: false },
        { status: 404 },
      );
    }
    await enqueueOperation({
      operationType: "MARK_DISPUTE",
      dedupeKey: sale.purchaseId ?? sale.paymentIntentId ?? `dispute:${saleSummaryId}`,
      correlations: {
        paymentIntentId: sale.paymentIntentId ?? null,
        purchaseId: sale.purchaseId ?? null,
      },
      payload: {
        saleSummaryId,
        paymentIntentId: sale.paymentIntentId ?? null,
        purchaseId: sale.purchaseId ?? null,
        reason,
      },
    });

    await auditAdminAction({
      action: "PAYMENT_DISPUTE",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        saleSummaryId,
        paymentIntentId: sale.paymentIntentId ?? null,
        purchaseId: sale.purchaseId ?? null,
        reason,
      },
    });
    return respondOk(ctx, { queued: true }, { status: 200 });
  } catch (err) {
    logError("admin.payments.dispute_failed", err);
    return respondError(
      ctx,
      { errorCode: "FAILED", message: "Falha ao processar disputa.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
