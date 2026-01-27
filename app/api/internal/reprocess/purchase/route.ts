export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { purchaseId?: string } | null;
  const purchaseId = typeof body?.purchaseId === "string" ? body.purchaseId.trim() : "";
  if (!purchaseId) {
    return NextResponse.json({ ok: false, error: "INVALID_PURCHASE_ID" }, { status: 400 });
  }

  const dedupe = purchaseId;
  await enqueueOperation({
    operationType: "FULFILL_PAYMENT",
    dedupeKey: dedupe,
    correlations: { purchaseId, paymentIntentId: purchaseId },
    payload: { purchaseId, paymentIntentId: purchaseId },
  });

  return NextResponse.json({ ok: true, requeued: true, operationType: "FULFILL_PAYMENT", dedupeKey: dedupe }, { status: 200 });
}
