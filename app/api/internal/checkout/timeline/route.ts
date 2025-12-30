import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

/**
 * Endpoint interno para inspecionar a timeline de checkout.
 * Uso: /api/internal/checkout/timeline?purchaseId=... ou ?paymentIntentId=...
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const purchaseId = (url.searchParams.get("purchaseId") || "").trim();
  const paymentIntentId = (url.searchParams.get("paymentIntentId") || "").trim();

  if (!purchaseId && !paymentIntentId) {
    return NextResponse.json(
      { ok: false, error: "Missing purchaseId or paymentIntentId" },
      { status: 400 },
    );
  }

  const summary = await prisma.saleSummary.findFirst({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    include: {
      lines: true,
    },
  });

  const paymentEvents = await prisma.paymentEvent.findMany({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { createdAt: "asc" },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [
        summary?.id ? { saleSummaryId: summary.id } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
  });

  const refunds = await prisma.refund?.findMany
    ? await (prisma as any).refund.findMany({
        where: {
          OR: [
            purchaseId ? { purchaseId } : undefined,
            paymentIntentId ? { paymentIntentId } : undefined,
          ].filter(Boolean) as any,
        },
      })
    : [];

  return NextResponse.json(
    {
      ok: true,
      purchaseId: summary?.purchaseId ?? purchaseId ?? null,
      paymentIntentId: summary?.paymentIntentId ?? paymentIntentId ?? null,
      saleSummary: summary,
      paymentEvents,
      tickets,
      refunds,
    },
    { status: 200 },
  );
}
