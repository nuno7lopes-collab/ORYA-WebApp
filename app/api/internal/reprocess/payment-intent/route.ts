export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

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

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as { paymentIntentId?: string } | null;
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  if (!paymentIntentId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_PAYMENT_INTENT_ID", message: "paymentIntentId inválido.", retryable: false },
      { status: 400 },
    );
  }

  const dedupe = paymentIntentId;
  await enqueueOperation({
    operationType: "FULFILL_PAYMENT",
    dedupeKey: dedupe,
    correlations: { paymentIntentId, purchaseId: paymentIntentId },
    payload: { paymentIntentId },
  });

  return respondOk(ctx, { requeued: true, operationType: "FULFILL_PAYMENT", dedupeKey: dedupe }, { status: 200 });
}
