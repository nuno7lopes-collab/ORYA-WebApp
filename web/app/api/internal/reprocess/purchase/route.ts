export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

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
