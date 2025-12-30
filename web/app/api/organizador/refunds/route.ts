export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { OrganizerMemberRole } from "@prisma/client";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";
import { randomUUID } from "crypto";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

type RefundBody = {
  purchaseId?: string;
  paymentIntentId?: string;
  saleSummaryId?: number;
  amountCents?: number;
  refundId?: string;
  reason?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RefundBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const purchaseId =
    typeof body.purchaseId === "string" && body.purchaseId.trim()
      ? body.purchaseId.trim()
      : null;
  const paymentIntentId =
    typeof body.paymentIntentId === "string" && body.paymentIntentId.trim()
      ? body.paymentIntentId.trim()
      : null;
  const saleSummaryId =
    typeof body.saleSummaryId === "number" && Number.isFinite(body.saleSummaryId)
      ? body.saleSummaryId
      : null;
  const amountCents =
    typeof body.amountCents === "number" && Number.isFinite(body.amountCents)
      ? Math.round(body.amountCents)
      : null;
  const refundId =
    typeof body.refundId === "string" && body.refundId.trim()
      ? body.refundId.trim()
      : randomUUID();
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().toUpperCase()
      : "CANCELLED";

  if (!purchaseId && !paymentIntentId && !saleSummaryId) {
    return NextResponse.json({ ok: false, error: "MISSING_IDENTIFIER" }, { status: 400 });
  }

  const saleSummary = await prisma.saleSummary.findFirst({
    where: {
      OR: [
        saleSummaryId ? { id: saleSummaryId } : undefined,
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { paymentIntentId } : undefined,
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
    select: {
      id: true,
      eventId: true,
      purchaseId: true,
      paymentIntentId: true,
      totalCents: true,
      status: true,
    },
  });

  if (!saleSummary) {
    return NextResponse.json({ ok: false, error: "SALE_NOT_FOUND" }, { status: 404 });
  }

  const event = await prisma.event.findUnique({
    where: { id: saleSummary.eventId },
    select: { organizerId: true },
  });
  if (!event?.organizerId) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer || !membership) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const purchaseAnchor = saleSummary.purchaseId ?? saleSummary.paymentIntentId ?? purchaseId ?? paymentIntentId;
  if (!purchaseAnchor) {
    return NextResponse.json({ ok: false, error: "MISSING_PURCHASE" }, { status: 400 });
  }

  const refundedAgg = await prisma.refund.aggregate({
    where: { purchaseId: purchaseAnchor },
    _sum: { baseAmountCents: true },
  });
  const refundedSoFar = refundedAgg._sum.baseAmountCents ?? 0;
  const remaining = Math.max(0, saleSummary.totalCents - refundedSoFar);
  const refundAmount = amountCents ?? remaining;

  if (remaining <= 0) {
    return NextResponse.json({ ok: false, error: "ALREADY_REFUNDED" }, { status: 409 });
  }

  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > remaining) {
    return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
  }

  await enqueueOperation({
    operationType: "PROCESS_REFUND_SINGLE",
    dedupeKey: refundKey(purchaseAnchor, refundId),
    correlations: {
      eventId: saleSummary.eventId,
      purchaseId: purchaseAnchor,
      paymentIntentId: saleSummary.paymentIntentId ?? null,
    },
    payload: {
      eventId: saleSummary.eventId,
      purchaseId: purchaseAnchor,
      paymentIntentId: saleSummary.paymentIntentId ?? null,
      amountCents: refundAmount,
      refundId,
      reason,
      refundedBy: user.id,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      refundId,
      amountCents: refundAmount,
      remainingAfterCents: Math.max(0, remaining - refundAmount),
    },
    { status: 200 },
  );
}
