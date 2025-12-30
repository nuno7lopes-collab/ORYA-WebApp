export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueOperation } from "@/lib/operations/enqueue";
import crypto from "crypto";

const DEFAULT_STUCK_MINUTES = 15;
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

  const body = (await req.json().catch(() => null)) as { minutes?: number } | null;
  const minutes = Number(body?.minutes ?? DEFAULT_STUCK_MINUTES);
  const threshold = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000);

  const requeued: Array<{ type: string; key: string }> = [];

  // PaymentEvents sem SaleSummary há muito tempo → reenfileirar FULFILL_PAYMENT
  const events = await prisma.paymentEvent.findMany({
    where: {
      status: { in: ["PROCESSING", "OK"] },
      updatedAt: { lt: threshold },
    },
    select: { stripePaymentIntentId: true, purchaseId: true },
    take: 50,
  });

  for (const ev of events) {
    const hasSummary = await prisma.saleSummary.findFirst({
      where: {
        OR: [
          ev.purchaseId ? { purchaseId: ev.purchaseId } : undefined,
          ev.stripePaymentIntentId ? { paymentIntentId: ev.stripePaymentIntentId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    });
    if (hasSummary) continue;
    const dedupe = ev.stripePaymentIntentId ?? ev.purchaseId ?? crypto.randomUUID();
    await enqueueOperation({
      operationType: "FULFILL_PAYMENT",
      dedupeKey: dedupe,
      correlations: {
        paymentIntentId: ev.stripePaymentIntentId ?? null,
        purchaseId: ev.purchaseId ?? ev.stripePaymentIntentId ?? null,
      },
      payload: { paymentIntentId: ev.stripePaymentIntentId ?? null },
    });
    requeued.push({ type: "FULFILL_PAYMENT", key: dedupe });
  }

  // Operations RUNNING há demasiado tempo → marcar FAILED e deixar serem reprocessadas via dedupe
  const running = await prisma.operation.findMany({
    where: { status: "RUNNING", lockedAt: { lt: threshold } },
    take: 50,
  });
  for (const op of running) {
    await prisma.operation.update({
      where: { id: op.id },
      data: { status: "FAILED", lockedAt: null, nextRetryAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, requeued }, { status: 200 });
}
