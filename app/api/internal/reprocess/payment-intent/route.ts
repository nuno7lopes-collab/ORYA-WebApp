export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function ensureInternalSecret(req: NextRequest, ctx: { requestId: string; correlationId: string }) {
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }
  return null;
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as {
    paymentIntentId?: string;
    purchaseId?: string | null;
  } | null;
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  const purchaseIdFromBody = typeof body?.purchaseId === "string" ? body.purchaseId.trim() : "";
  if (!paymentIntentId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_PAYMENT_INTENT_ID", message: "paymentIntentId inválido.", retryable: false },
      { status: 400 },
    );
  }
  if (!paymentIntentId.startsWith("pi_")) {
    return respondError(
      ctx,
      { errorCode: "INVALID_PAYMENT_INTENT_ID", message: "paymentIntentId inválido.", retryable: false },
      { status: 400 },
    );
  }

  let purchaseId = purchaseIdFromBody || null;
  if (!purchaseId) {
    const paymentEvent = await prisma.paymentEvent.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { purchaseId: true },
    });
    purchaseId = paymentEvent?.purchaseId ?? null;
  }
  if (!purchaseId) {
    const sale = await prisma.saleSummary.findFirst({
      where: { paymentIntentId },
      select: { purchaseId: true },
    });
    purchaseId = sale?.purchaseId ?? null;
  }

  const dedupe = paymentIntentId;
  await enqueueOperation({
    operationType: "FULFILL_PAYMENT",
    dedupeKey: dedupe,
    correlations: { paymentIntentId, purchaseId },
    payload: { paymentIntentId, purchaseId },
  });

  return respondOk(
    ctx,
    { requeued: true, operationType: "FULFILL_PAYMENT", dedupeKey: dedupe, purchaseId },
    { status: 200 },
  );
}
export const POST = withApiEnvelope(_POST);
