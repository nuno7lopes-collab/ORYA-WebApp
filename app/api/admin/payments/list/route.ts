// app/api/admin/payments/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import type { Prisma, PaymentMode } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const PAGE_SIZE = 50;

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
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
        { purchaseId: { contains: q, mode: "insensitive" } },
        { stripeEventId: { contains: q, mode: "insensitive" } },
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

    const purchaseIds = Array.from(
      new Set(trimmed.map((item) => item.purchaseId).filter(Boolean)),
    ) as string[];
    const summaries = purchaseIds.length
      ? await prisma.saleSummary.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { id: true, purchaseId: true, paymentIntentId: true, status: true },
        })
      : [];
    const intentIds = Array.from(
      new Set(summaries.map((summary) => summary.paymentIntentId).filter(Boolean)),
    ) as string[];
    const payouts = intentIds.length
      ? await prisma.pendingPayout.findMany({
          where: { paymentIntentId: { in: intentIds } },
          select: {
            paymentIntentId: true,
            status: true,
            holdUntil: true,
            transferId: true,
            amountCents: true,
          },
        })
      : [];
    const payoutByIntent = new Map(payouts.map((p) => [p.paymentIntentId, p]));
    const summaryByPurchaseId = new Map(
      summaries.map((summary) => [summary.purchaseId, summary]),
    );

    const enriched = trimmed.map((item) => {
      const summary = item.purchaseId ? summaryByPurchaseId.get(item.purchaseId) : null;
      const payout = summary?.paymentIntentId
        ? payoutByIntent.get(summary.paymentIntentId)
        : null;
      return {
        ...item,
        paymentIntentId: summary?.paymentIntentId ?? null,
        saleSummaryId: summary?.id ?? null,
        saleStatus: summary?.status ?? null,
        payoutStatus: payout?.status ?? null,
        payoutHoldUntil: payout?.holdUntil ?? null,
        payoutTransferId: payout?.transferId ?? null,
        payoutAmountCents: payout?.amountCents ?? null,
      };
    });

    return jsonWrap(
      {
        ok: true,
        items: enriched,
        pagination: { nextCursor, hasMore },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/payments/list]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);