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

  const body = (await req.json().catch(() => null)) as {
    stripeEventId?: string;
    paymentIntentId?: string | null;
  } | null;
  const stripeEventId = typeof body?.stripeEventId === "string" ? body.stripeEventId.trim() : "";
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : null;

  if (!stripeEventId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_STRIPE_EVENT_ID", message: "stripeEventId inválido.", retryable: false },
      { status: 400 },
    );
  }

  await enqueueOperation({
    operationType: "PROCESS_STRIPE_EVENT",
    dedupeKey: stripeEventId,
    correlations: { stripeEventId, paymentIntentId: paymentIntentId ?? null },
    payload: { stripeEventType: "unknown", paymentIntentId: paymentIntentId ?? null },
  });

  return respondOk(ctx, { requeued: true, operationType: "PROCESS_STRIPE_EVENT", dedupeKey: stripeEventId }, { status: 200 });
}
