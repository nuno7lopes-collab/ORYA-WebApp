import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { logPendingPayoutAudit } from "@/lib/payments/payoutAdmin";
import { PendingPayoutStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return jsonWrap({ ok: false, error: auth.error }, { status: auth.status });
  }

  const resolved = await params;
  const payoutId = Number(resolved.id);
  if (!Number.isFinite(payoutId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "ADMIN_BLOCK";

  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (payout.status === PendingPayoutStatus.RELEASED || payout.status === PendingPayoutStatus.CANCELLED) {
    return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
  }

  const updated = await prisma.pendingPayout.update({
    where: { id: payoutId },
    data: { status: PendingPayoutStatus.BLOCKED, blockedReason: reason },
  });

  await logPendingPayoutAudit({
    payout: updated,
    actorUserId: auth.userId,
    action: "ADMIN_PAYOUT_BLOCK",
    metadata: { reason },
  });

  return jsonWrap({ ok: true, payout: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
