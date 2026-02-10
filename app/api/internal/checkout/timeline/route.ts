import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * Endpoint interno para inspecionar a timeline de checkout.
 * Uso: /api/internal/checkout/timeline?purchaseId=... ou ?paymentIntentId=...
 */
async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const purchaseId = (url.searchParams.get("purchaseId") || "").trim();
  const paymentIntentId = (url.searchParams.get("paymentIntentId") || "").trim();

  if (!purchaseId && !paymentIntentId) {
    return respondError(
      ctx,
      { errorCode: "MISSING_ID", message: "Missing purchaseId or paymentIntentId", retryable: false },
      { status: 400 },
    );
  }

  const summary = await prisma.saleSummary.findFirst({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    include: {
      lines: true,
    },
  });

  const paymentEvents = await prisma.paymentEvent.findMany({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { createdAt: "asc" },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [
        summary?.id ? { saleSummaryId: summary.id } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
  });

  const refunds = await prisma.refund?.findMany
    ? await (prisma as any).refund.findMany({
        where: {
          OR: [
            purchaseId ? { purchaseId } : undefined,
            paymentIntentId ? { paymentIntentId } : undefined,
          ].filter(Boolean) as any,
        },
      })
    : [];

  const resolvedPurchaseId = summary?.purchaseId ?? purchaseId ?? null;
  const statusMap = resolvedPurchaseId
    ? await resolvePaymentStatusMap([resolvedPurchaseId])
    : new Map();
  const resolved = resolvedPurchaseId ? statusMap.get(resolvedPurchaseId) : null;
  const payment = resolvedPurchaseId
    ? await prisma.payment.findUnique({
        where: { id: resolvedPurchaseId },
        select: { id: true, status: true, sourceType: true, sourceId: true, createdAt: true },
      })
    : null;
  const snapshot = resolvedPurchaseId
    ? await prisma.paymentSnapshot.findUnique({
        where: { paymentId: resolvedPurchaseId },
        select: { paymentId: true, status: true, grossCents: true, netToOrgCents: true, updatedAt: true },
      })
    : null;

  return respondOk(
    ctx,
    {
      purchaseId: resolvedPurchaseId,
      paymentIntentId: summary?.paymentIntentId ?? paymentIntentId ?? null,
      resolvedStatus: resolved?.status ?? "PROCESSING",
      resolvedStatusSource: resolved?.source ?? "NONE",
      payment,
      paymentSnapshot: snapshot,
      saleSummary: summary,
      paymentEvents,
      tickets,
      refunds,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
