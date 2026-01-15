import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { logPendingPayoutAudit } from "@/lib/payments/payoutAdmin";
import { releaseSinglePayout } from "@/lib/payments/releaseWorker";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const resolved = await params;
  const payoutId = Number(resolved.id);
  if (!Number.isFinite(payoutId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const result = await releaseSinglePayout(payoutId, { force: true });
  if (result.status !== "RELEASED") {
    return NextResponse.json({ ok: false, error: result.error ?? "RELEASE_FAILED" }, { status: 409 });
  }

  const updated = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (updated) {
    await logPendingPayoutAudit({
      payout: updated,
      actorUserId: auth.userId,
      action: "ADMIN_PAYOUT_FORCE_RELEASE",
    });
  }

  return NextResponse.json({ ok: true, payout: updated ?? payout }, { status: 200 });
}
