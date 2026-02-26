// app/api/admin/refunds/retry/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { RefundCaseStatus } from "@prisma/client";

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

    const body = (await req.json().catch(() => null)) as { operationId?: number | string } | null;
    const operationId =
      typeof body?.operationId === "number"
        ? body.operationId
        : typeof body?.operationId === "string"
          ? Number(body.operationId)
          : NaN;

    if (!Number.isFinite(operationId)) {
      return respondError(
        ctx,
        { errorCode: "INVALID_OPERATION", message: "Operação inválida.", retryable: false },
        { status: 400 },
      );
    }

    const op = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { id: true, operationType: true, payload: true },
    });
    if (
      !op ||
      (op.operationType !== "PROCESS_REFUND_SINGLE" &&
        op.operationType !== "PROCESS_REFUND_UNIFIED")
    ) {
      return respondError(
        ctx,
        { errorCode: "NOT_FOUND", message: "Operação não encontrada.", retryable: false },
        { status: 404 },
      );
    }

    await prisma.operation.update({
      where: { id: operationId },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    });

    const payload = op.payload as Record<string, unknown> | null;
    const refundCaseId =
      payload && typeof payload.refundCaseId === "string" ? payload.refundCaseId : null;
    if (refundCaseId) {
      await prisma.refundCase.updateMany({
        where: { id: refundCaseId },
        data: {
          status: RefundCaseStatus.REQUESTED,
          lastError: null,
          nextRetryAt: new Date(),
        },
      });
    }

    await auditAdminAction({
      action: "REFUND_RETRY",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: { operationId, operationType: op.operationType },
    });

    return respondOk(ctx, { retried: true }, { status: 200 });
  } catch (err) {
    logError("admin.refunds.retry_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
