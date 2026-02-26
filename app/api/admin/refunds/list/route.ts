// app/api/admin/refunds/list/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import type { Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const PAGE_SIZE = 50;

async function _GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;

    const where: Prisma.OperationWhereInput = {
      operationType: { in: ["PROCESS_REFUND_UNIFIED", "PROCESS_REFUND_SINGLE"] },
    };

    if (statusParam === "PENDING") {
      where.status = { in: ["PENDING", "RUNNING"] };
    } else if (statusParam === "FAILED") {
      where.status = { in: ["FAILED", "DEAD_LETTER"] };
    } else if (statusParam === "SUCCEEDED") {
      where.status = "SUCCEEDED";
    }

    if (q) {
      const qNum = Number(q);
      const maybeNumber = Number.isFinite(qNum) ? qNum : null;
      where.OR = [
        { purchaseId: { contains: q, mode: "insensitive" } },
        { paymentIntentId: { contains: q, mode: "insensitive" } },
        { dedupeKey: { contains: q, mode: "insensitive" } },
        ...(maybeNumber ? [{ eventId: maybeNumber }] : []),
      ];
    }

    const ops = await prisma.operation.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = ops.length > PAGE_SIZE;
    const trimmed = hasMore ? ops.slice(0, PAGE_SIZE) : ops;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const purchaseIds = Array.from(new Set(trimmed.map((op) => op.purchaseId).filter(Boolean))) as string[];
    const paymentIntentIds = Array.from(new Set(trimmed.map((op) => op.paymentIntentId).filter(Boolean))) as string[];
    const refundCaseIds = Array.from(
      new Set(
        trimmed
          .map((op) => {
            const payload = op.payload as Record<string, unknown> | null;
            return typeof payload?.refundCaseId === "string" ? payload.refundCaseId : null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const refunds = purchaseIds.length || paymentIntentIds.length
      ? await prisma.refund.findMany({
          where: {
            OR: [
              purchaseIds.length ? { purchaseId: { in: purchaseIds } } : undefined,
              paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : undefined,
            ].filter(Boolean) as Prisma.RefundWhereInput[],
          },
        })
      : [];

    const refundCases =
      refundCaseIds.length || purchaseIds.length || paymentIntentIds.length
        ? await prisma.refundCase.findMany({
            where: {
              OR: [
                refundCaseIds.length ? { id: { in: refundCaseIds } } : undefined,
                purchaseIds.length ? { paymentId: { in: purchaseIds } } : undefined,
                paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : undefined,
              ].filter(Boolean) as Prisma.RefundCaseWhereInput[],
            },
          })
        : [];

    const refundByPurchase = new Map(refunds.filter((r) => r.purchaseId).map((r) => [r.purchaseId!, r]));
    const refundByPaymentIntent = new Map(refunds.filter((r) => r.paymentIntentId).map((r) => [r.paymentIntentId!, r]));
    const refundCaseById = new Map(refundCases.map((refundCase) => [refundCase.id, refundCase]));
    const refundCaseByPayment = new Map(refundCases.map((refundCase) => [refundCase.paymentId, refundCase]));
    const refundCaseByIntent = new Map(
      refundCases
        .filter((refundCase) => refundCase.paymentIntentId)
        .map((refundCase) => [refundCase.paymentIntentId!, refundCase]),
    );

    const items = trimmed.map((op) => {
      const payload = op.payload as Record<string, unknown> | null;
      const opRefundCaseId = typeof payload?.refundCaseId === "string" ? payload.refundCaseId : null;
      const refundCase = opRefundCaseId
        ? refundCaseById.get(opRefundCaseId) ?? null
        : op.purchaseId
          ? refundCaseByPayment.get(op.purchaseId) ?? null
          : op.paymentIntentId
            ? refundCaseByIntent.get(op.paymentIntentId) ?? null
            : null;
      const refund = op.purchaseId
        ? refundByPurchase.get(op.purchaseId)
        : op.paymentIntentId
          ? refundByPaymentIntent.get(op.paymentIntentId)
          : null;
      const status =
        op.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : op.status === "FAILED" || op.status === "DEAD_LETTER"
            ? "FAILED"
            : "PENDING";
      return {
        id: op.id,
        status,
        opStatus: op.status,
        attempts: op.attempts,
        lastError: op.lastError,
        purchaseId: op.purchaseId,
        paymentIntentId: op.paymentIntentId,
        eventId: op.eventId,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
        refundCaseId: refundCase?.id ?? null,
        refundStatus: refundCase?.status ?? null,
        refund:
          refundCase
            ? {
                id: refundCase.id,
                amountCents:
                  refundCase.amountsBreakdown &&
                  typeof refundCase.amountsBreakdown === "object" &&
                  !Array.isArray(refundCase.amountsBreakdown) &&
                  typeof (refundCase.amountsBreakdown as Record<string, unknown>).refundCents === "number"
                    ? Number((refundCase.amountsBreakdown as Record<string, unknown>).refundCents)
                    : null,
                stripeRefundId: refundCase.stripeRefundId,
                reasonCode: refundCase.reasonCode,
                status: refundCase.status,
              }
            : refund
              ? {
                  id: refund.id,
                  baseAmountCents: refund.baseAmountCents,
                  feesExcludedCents: refund.feesExcludedCents,
                  refundedAt: refund.refundedAt,
                  stripeRefundId: refund.stripeRefundId,
                  reason: refund.reason,
                }
              : null,
      };
    });

    return respondOk(
      ctx,
      { items, pagination: { nextCursor, hasMore } },
      { status: 200 },
    );
  } catch (err) {
    logError("admin.refunds.list_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
