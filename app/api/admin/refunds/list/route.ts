// app/api/admin/refunds/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

async function ensureAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401 as const, reason: "UNAUTHENTICATED" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  if (!isAdmin) {
    return { ok: false as const, status: 403 as const, reason: "FORBIDDEN" };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.reason }, { status: admin.status });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;

    const where: Prisma.OperationWhereInput = {
      operationType: "PROCESS_REFUND_SINGLE",
    };

    if (statusParam === "PENDING") {
      where.status = { in: ["PENDING", "RUNNING"] };
    } else if (statusParam === "FAILED") {
      where.status = { in: ["FAILED", "DEAD_LETTER"] };
    } else if (statusParam === "SUCCEEDED") {
      where.status = "SUCCEEDED";
    }

    if (q) {
      const qNum = Number(q);
      const maybeNumber = Number.isFinite(qNum) ? qNum : null;
      where.OR = [
        { purchaseId: { contains: q, mode: "insensitive" } },
        { paymentIntentId: { contains: q, mode: "insensitive" } },
        { dedupeKey: { contains: q, mode: "insensitive" } },
        ...(maybeNumber ? [{ eventId: maybeNumber }] : []),
      ];
    }

    const ops = await prisma.operation.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = ops.length > PAGE_SIZE;
    const trimmed = hasMore ? ops.slice(0, PAGE_SIZE) : ops;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const purchaseIds = Array.from(new Set(trimmed.map((op) => op.purchaseId).filter(Boolean))) as string[];
    const paymentIntentIds = Array.from(new Set(trimmed.map((op) => op.paymentIntentId).filter(Boolean))) as string[];

    const refunds = purchaseIds.length || paymentIntentIds.length
      ? await prisma.refund.findMany({
          where: {
            OR: [
              purchaseIds.length ? { purchaseId: { in: purchaseIds } } : undefined,
              paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : undefined,
            ].filter(Boolean) as Prisma.RefundWhereInput[],
          },
        })
      : [];

    const refundByPurchase = new Map(refunds.filter((r) => r.purchaseId).map((r) => [r.purchaseId!, r]));
    const refundByPaymentIntent = new Map(refunds.filter((r) => r.paymentIntentId).map((r) => [r.paymentIntentId!, r]));

    const items = trimmed.map((op) => {
      const refund = op.purchaseId
        ? refundByPurchase.get(op.purchaseId)
        : op.paymentIntentId
          ? refundByPaymentIntent.get(op.paymentIntentId)
          : null;
      const status =
        op.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : op.status === "FAILED" || op.status === "DEAD_LETTER"
            ? "FAILED"
            : "PENDING";
      return {
        id: op.id,
        status,
        opStatus: op.status,
        attempts: op.attempts,
        lastError: op.lastError,
        purchaseId: op.purchaseId,
        paymentIntentId: op.paymentIntentId,
        eventId: op.eventId,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
        refund: refund
          ? {
              id: refund.id,
              baseAmountCents: refund.baseAmountCents,
              feesExcludedCents: refund.feesExcludedCents,
              refundedAt: refund.refundedAt,
              stripeRefundId: refund.stripeRefundId,
              reason: refund.reason,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        items,
        pagination: { nextCursor, hasMore },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/refunds/list]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
