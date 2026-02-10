export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
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

  const body = (await req.json().catch(() => null)) as { purchaseId?: string } | null;
  const purchaseId = typeof body?.purchaseId === "string" ? body.purchaseId.trim() : "";
  if (!purchaseId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_PURCHASE_ID", message: "purchaseId inválido.", retryable: false },
      { status: 400 },
    );
  }

  const dedupe = purchaseId;
  await enqueueOperation({
    operationType: "FULFILL_PAYMENT",
    dedupeKey: dedupe,
    correlations: { purchaseId, paymentIntentId: purchaseId },
    payload: { purchaseId, paymentIntentId: purchaseId },
  });

  return respondOk(ctx, { requeued: true, operationType: "FULFILL_PAYMENT", dedupeKey: dedupe }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
