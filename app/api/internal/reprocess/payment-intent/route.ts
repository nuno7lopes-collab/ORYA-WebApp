export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { paymentIntentId?: string } | null;
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  if (!paymentIntentId) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYMENT_INTENT_ID" }, { status: 400 });
  }

  const dedupe = paymentIntentId;
  await enqueueOperation({
    operationType: "FULFILL_PAYMENT",
    dedupeKey: dedupe,
    correlations: { paymentIntentId, purchaseId: paymentIntentId },
    payload: { paymentIntentId },
  });

  return NextResponse.json({ ok: true, requeued: true, operationType: "FULFILL_PAYMENT", dedupeKey: dedupe }, { status: 200 });
}
