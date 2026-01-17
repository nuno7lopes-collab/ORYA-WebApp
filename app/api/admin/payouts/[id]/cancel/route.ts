import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { logPendingPayoutAudit } from "@/lib/payments/payoutAdmin";
import { PendingPayoutStatus } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const resolved = await params;
  const payoutId = Number(resolved.id);
  if (!Number.isFinite(payoutId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "ADMIN_CANCEL";

  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (payout.status === PendingPayoutStatus.RELEASED) {
    return NextResponse.json({ ok: false, error: "ALREADY_RELEASED" }, { status: 409 });
  }

  const updated = await prisma.pendingPayout.update({
    where: { id: payoutId },
    data: { status: PendingPayoutStatus.CANCELLED, blockedReason: reason },
  });

  await logPendingPayoutAudit({
    payout: updated,
    actorUserId: auth.userId,
    action: "ADMIN_PAYOUT_CANCEL",
    metadata: { reason },
  });

  return NextResponse.json({ ok: true, payout: updated }, { status: 200 });
}
