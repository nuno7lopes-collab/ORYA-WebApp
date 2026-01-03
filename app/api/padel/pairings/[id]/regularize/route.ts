export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingLifecycleStatus, PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { clampDeadlineHours, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { readNumericParam } from "@/lib/routeParams";

// Regulariza uma dupla cancelada por falha de pagamento (SPLIT).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = readNumericParam(params?.id, req, "pairings");
  if (pairingId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      slots: true,
      event: {
        select: {
          organizationId: true,
          startsAt: true,
          padelTournamentConfig: { select: { splitDeadlineHours: true } },
        },
      },
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.payment_mode !== PadelPaymentMode.SPLIT) {
    return NextResponse.json({ ok: false, error: "NOT_SPLIT_MODE" }, { status: 400 });
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizationMember.findFirst({
      where: {
        organizationId: pairing.organizationId,
        userId: user.id,
        role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
      },
      select: { id: true },
    });
    isStaff = Boolean(staff);
  }
  if (!isCaptain && !isStaff) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (pairing.pairingStatus !== "CANCELLED" || pairing.lifecycleStatus !== "CANCELLED_INCOMPLETE") {
    return NextResponse.json({ ok: false, error: "PAIRING_NOT_CANCELLED" }, { status: 409 });
  }
  if (!["FAILED", "EXPIRED"].includes(pairing.guaranteeStatus)) {
    return NextResponse.json({ ok: false, error: "REGULARIZE_NOT_ALLOWED" }, { status: 409 });
  }

  const now = new Date();
  const deadlineAt = computeSplitDeadlineAt(
    now,
    pairing.event?.startsAt ?? null,
    clampDeadlineHours(pairing.event?.padelTournamentConfig?.splitDeadlineHours ?? undefined),
  );
  if (deadlineAt.getTime() <= now.getTime()) {
    return NextResponse.json({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (!partnerSlot) {
    return NextResponse.json({ ok: false, error: "NO_PARTNER_SLOT" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.update({
      where: { id: partnerSlot.id },
      data: {
        slotStatus: PadelPairingSlotStatus.PENDING,
        paymentStatus: PadelPairingPaymentStatus.UNPAID,
        ticketId: null,
      },
    });

    return tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        pairingStatus: "INCOMPLETE",
        lifecycleStatus: PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT,
        guaranteeStatus: "ARMED",
        deadlineAt,
        partnerSwapAllowedUntilAt: deadlineAt,
        secondChargePaymentIntentId: null,
        graceUntilAt: null,
        captainSecondChargedAt: null,
      },
      include: { slots: true },
    });
  });

  return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
}
