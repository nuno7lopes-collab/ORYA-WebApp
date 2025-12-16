import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Status =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED";

const FINAL_STATUSES: Status[] = ["PAID", "FAILED", "REFUNDED", "DISPUTED"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const purchaseId = url.searchParams.get("purchaseId");
  const paymentIntentId = url.searchParams.get("paymentIntentId");

  if (!purchaseId && !paymentIntentId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_ID", status: "FAILED" },
      { status: 400 },
    );
  }

  try {
    const summaryWhere: Prisma.SaleSummaryWhereInput = { OR: [] };
    if (purchaseId) summaryWhere.OR!.push({ purchaseId });
    if (paymentIntentId) summaryWhere.OR!.push({ paymentIntentId });

    // 1) SaleSummary = pago/emitido
    const summary = await prisma.saleSummary.findFirst({
      where: summaryWhere,
      select: {
        id: true,
        paymentIntentId: true,
        purchaseId: true,
        totalCents: true,
        promoCodeSnapshot: true,
        promoLabelSnapshot: true,
        promoCodeId: true,
        createdAt: true,
      },
    });

    if (summary) {
      return NextResponse.json(
        {
          ok: true,
          status: "PAID" as Status,
          purchaseId: summary.purchaseId ?? purchaseId ?? paymentIntentId,
          paymentIntentId: summary.paymentIntentId,
          final: true,
        },
        { status: 200 },
      );
    }

    // 2) payment_events ainda em processamento
    const eventWhere: Prisma.PaymentEventWhereInput = { OR: [] };
    if (purchaseId) eventWhere.OR!.push({ purchaseId });
    if (paymentIntentId) eventWhere.OR!.push({ stripePaymentIntentId: paymentIntentId });

    const paymentEvent = await prisma.paymentEvent.findFirst({
      where: eventWhere,
      orderBy: { updatedAt: "desc" },
      select: { status: true, stripePaymentIntentId: true, purchaseId: true, errorMessage: true },
    });

    if (paymentEvent) {
      const statusMap: Record<string, Status> = {
        OK: "PAID",
        PROCESSING: "PROCESSING",
        ERROR: "FAILED",
        REFUNDED: "REFUNDED",
      };
      const mapped = statusMap[paymentEvent.status] ?? ("PROCESSING" as Status);
      return NextResponse.json(
        {
          ok: true,
          status: mapped,
          purchaseId: paymentEvent.purchaseId ?? purchaseId ?? paymentIntentId,
          paymentIntentId: paymentEvent.stripePaymentIntentId ?? paymentIntentId,
          final: FINAL_STATUSES.includes(mapped),
          errorMessage: paymentEvent.errorMessage ?? null,
        },
        { status: 200 },
      );
    }

    // 3) fallback
    return NextResponse.json(
      {
        ok: true,
        status: "PENDING" as Status,
        purchaseId: purchaseId ?? paymentIntentId,
        paymentIntentId,
        final: false,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[checkout/status] erro inesperado", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", status: "FAILED" },
      { status: 500 },
    );
  }
}
