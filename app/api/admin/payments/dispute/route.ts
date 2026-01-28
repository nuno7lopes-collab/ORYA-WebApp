import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
  }

  const body = await req.json().catch(() => ({}));
  const saleSummaryId = Number(body?.saleSummaryId);
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!Number.isFinite(saleSummaryId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  // Nota: sem RBAC forte (exemplo). Para produção, colocar auth/admin.

  try {
    const sale = await prisma.saleSummary.findUnique({
      where: { id: saleSummaryId },
      select: { purchaseId: true, paymentIntentId: true },
    });
    if (!sale) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
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
    return jsonWrap({ ok: true, queued: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/dispute] erro", err);
    return jsonWrap({ ok: false, error: "FAILED" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);