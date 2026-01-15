// app/api/admin/payments/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import type { Prisma, PaymentMode } from "@prisma/client";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor");
    const modeParam = (url.searchParams.get("mode") || "ALL").toUpperCase();

    const cursor = cursorRaw ? Number(cursorRaw) : null;
    const where: Prisma.PaymentEventWhereInput = {};

    if (statusParam !== "ALL") {
      where.status = statusParam;
    }

    if (modeParam === "LIVE" || modeParam === "TEST") {
      where.mode = modeParam as PaymentMode;
    }

    if (q) {
      const qNum = Number(q);
      const maybeNumber = Number.isFinite(qNum) ? qNum : null;
      where.OR = [
        { stripePaymentIntentId: { contains: q, mode: "insensitive" } },
        { errorMessage: { contains: q, mode: "insensitive" } },
        ...(maybeNumber ? [{ eventId: maybeNumber }] : []),
        { userId: q },
      ];
    }

    const items = await prisma.paymentEvent.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > PAGE_SIZE;
    const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const intentIds = Array.from(
      new Set(trimmed.map((item) => item.stripePaymentIntentId).filter(Boolean)),
    ) as string[];
    const [payouts, summaries] = await Promise.all([
      intentIds.length
        ? prisma.pendingPayout.findMany({
            where: { paymentIntentId: { in: intentIds } },
            select: {
              paymentIntentId: true,
              status: true,
              holdUntil: true,
              transferId: true,
              amountCents: true,
            },
          })
        : [],
      intentIds.length
        ? prisma.saleSummary.findMany({
            where: { paymentIntentId: { in: intentIds } },
            select: { id: true, paymentIntentId: true, status: true },
          })
        : [],
    ]);
    const payoutByIntent = new Map(payouts.map((p) => [p.paymentIntentId, p]));
    const summaryByIntent = new Map(summaries.map((s) => [s.paymentIntentId, s]));

    const enriched = trimmed.map((item) => {
      const payout = payoutByIntent.get(item.stripePaymentIntentId);
      const summary = summaryByIntent.get(item.stripePaymentIntentId);
      return {
        ...item,
        saleSummaryId: summary?.id ?? null,
        saleStatus: summary?.status ?? null,
        payoutStatus: payout?.status ?? null,
        payoutHoldUntil: payout?.holdUntil ?? null,
        payoutTransferId: payout?.transferId ?? null,
        payoutAmountCents: payout?.amountCents ?? null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        items: enriched,
        pagination: { nextCursor, hasMore },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/payments/list]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
