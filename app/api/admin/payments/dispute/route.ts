import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const body = await req.json().catch(() => ({}));
  const saleSummaryId = Number(body?.saleSummaryId);
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!Number.isFinite(saleSummaryId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  // Nota: sem RBAC forte (exemplo). Para produção, colocar auth/admin.

  try {
    const sale = await prisma.saleSummary.findUnique({
      where: { id: saleSummaryId },
      select: { purchaseId: true, paymentIntentId: true },
    });
    if (!sale) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    await enqueueOperation({
      operationType: "MARK_DISPUTE",
      dedupeKey: sale.purchaseId ?? sale.paymentIntentId ?? `dispute:${saleSummaryId}`,
      correlations: {
        paymentIntentId: sale.paymentIntentId ?? null,
        purchaseId: sale.purchaseId ?? null,
      },
      payload: {
        saleSummaryId,
        paymentIntentId: sale.paymentIntentId ?? null,
        purchaseId: sale.purchaseId ?? null,
        reason,
      },
    });
    return NextResponse.json({ ok: true, queued: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/dispute] erro", err);
    return NextResponse.json({ ok: false, error: "FAILED" }, { status: 500 });
  }
}
