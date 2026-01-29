import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { logPendingPayoutAudit } from "@/lib/payments/payoutAdmin";
import { releaseSinglePayout } from "@/lib/payments/releaseWorker";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return respondError(
      ctx,
      { errorCode: auth.error, message: auth.error, retryable: false },
      { status: auth.status },
    );
  }

  const resolved = await params;
  const payoutId = Number(resolved.id);
  if (!Number.isFinite(payoutId)) {
    return respondError(
      ctx,
      { errorCode: "INVALID_ID", message: "ID inválido.", retryable: false },
      { status: 400 },
    );
  }

  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    return respondError(
      ctx,
      { errorCode: "NOT_FOUND", message: "Payout não encontrado.", retryable: false },
      { status: 404 },
    );
  }

  const result = await releaseSinglePayout(payoutId, { force: true });
  if (result.status !== "RELEASED") {
    return respondError(
      ctx,
      {
        errorCode: result.error ?? "RELEASE_FAILED",
        message: "Falha ao libertar payout.",
        retryable: false,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (updated) {
    await logPendingPayoutAudit({
      payout: updated,
      actorUserId: auth.userId,
      action: "ADMIN_PAYOUT_FORCE_RELEASE",
    });
  }

  return respondOk(ctx, { payout: updated ?? payout }, { status: 200 });
}
