import { NextRequest, NextResponse } from "next/server";
import { markSaleDisputed } from "@/domain/finance/disputes";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const saleSummaryId = Number(body?.saleSummaryId);
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : null;
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!Number.isFinite(saleSummaryId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  // Nota: sem RBAC forte (exemplo). Para produção, colocar auth/admin.

  try {
    const sale = await markSaleDisputed({ saleSummaryId, paymentIntentId, reason, purchaseId: null });
    return NextResponse.json({ ok: true, sale }, { status: 200 });
  } catch (err) {
    console.error("[admin/dispute] erro", err);
    return NextResponse.json({ ok: false, error: "FAILED" }, { status: 500 });
  }
}
