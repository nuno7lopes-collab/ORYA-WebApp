export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { stripeEventId?: string; paymentIntentId?: string | null } | null;
  const stripeEventId = typeof body?.stripeEventId === "string" ? body.stripeEventId.trim() : "";
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : null;

  if (!stripeEventId) {
    return jsonWrap({ ok: false, error: "INVALID_STRIPE_EVENT_ID" }, { status: 400 });
  }

  await enqueueOperation({
    operationType: "PROCESS_STRIPE_EVENT",
    dedupeKey: stripeEventId,
    correlations: { stripeEventId, paymentIntentId: paymentIntentId ?? null },
    payload: { stripeEventType: "unknown", paymentIntentId: paymentIntentId ?? null },
  });

  return jsonWrap({ ok: true, requeued: true, operationType: "PROCESS_STRIPE_EVENT", dedupeKey: stripeEventId }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);