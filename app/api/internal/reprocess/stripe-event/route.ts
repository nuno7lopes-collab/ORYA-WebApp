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

  const body = (await req.json().catch(() => null)) as { stripeEventId?: string; paymentIntentId?: string | null } | null;
  const stripeEventId = typeof body?.stripeEventId === "string" ? body.stripeEventId.trim() : "";
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : null;

  if (!stripeEventId) {
    return NextResponse.json({ ok: false, error: "INVALID_STRIPE_EVENT_ID" }, { status: 400 });
  }

  await enqueueOperation({
    operationType: "PROCESS_STRIPE_EVENT",
    dedupeKey: stripeEventId,
    correlations: { stripeEventId, paymentIntentId: paymentIntentId ?? null },
    payload: { stripeEventType: "unknown", paymentIntentId: paymentIntentId ?? null },
  });

  return NextResponse.json({ ok: true, requeued: true, operationType: "PROCESS_STRIPE_EVENT", dedupeKey: stripeEventId }, { status: 200 });
}
