export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
} from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { validateEligibility } from "@/domain/padelEligibility";
import { PairingAction, transition } from "@/domain/padelPairingStateMachine";

// Permite um parceiro juntar-se a um pairing com mode LOOKING_FOR_PARTNER / isPublicOpen sem token.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const pairingId = typeof body?.pairingId === "number" ? body.pairingId : Number(body?.pairingId);
  if (!Number.isFinite(pairingId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true, event: { select: { organizerId: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }
  if (pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "PAIRING_EXPIRED" }, { status: 410 });
  }
  if (
    pairing.pairingJoinMode !== "LOOKING_FOR_PARTNER" &&
    !pairing.isPublicOpen
  ) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Guard: utilizador já tem pairing ativo no torneio?
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId: pairing.eventId,
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      OR: [{ player1UserId: user.id }, { player2UserId: user.id }],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
  }

  const [captainProfile, partnerProfile] = await Promise.all([
    pairing.player1UserId
      ? prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
      : Promise.resolve(null),
    prisma.profile.findUnique({ where: { id: user.id }, select: { gender: true } }),
  ]);
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.eventId },
    select: { eligibilityType: true },
  });
  const eligibility = validateEligibility(
    (config?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    (captainProfile?.gender as Gender | null) ?? null,
    partnerProfile?.gender as Gender | null,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  if (pairing.paymentMode === PadelPaymentMode.SPLIT && pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
    return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_PARTNER" }, { status: 402 });
  }

  try {
    const action: PairingAction =
      pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? "PARTNER_PAID" : "PARTNER_ASSIGNED";
    const nextStatus = transition(
      (pairing.lifecycleStatus as PadelPairingLifecycleStatus) ?? "PENDING_ONE_PAID",
      action,
    );
    const partnerAcceptedAt = new Date();
    const partnerPaidAt =
      pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? new Date() : null;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPairing = await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          player2UserId: user.id,
          partnerInviteToken: null,
          partnerLinkToken: null,
          partnerInviteUsedAt: partnerAcceptedAt,
          partnerAcceptedAt,
          partnerPaidAt,
          lifecycleStatus: nextStatus,
          guaranteeStatus:
            pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? "SUCCEEDED" : pairing.guaranteeStatus,
          graceUntilAt:
            pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? null : pairing.graceUntilAt,
          slots: {
            update: {
              where: { id: pendingSlot.id },
              data: {
                profileId: user.id,
                slotStatus: PadelPairingSlotStatus.FILLED,
                paymentStatus:
                  pendingSlot.paymentStatus === "PAID"
                    ? pendingSlot.paymentStatus
                    : PadelPairingPaymentStatus.PAID,
              },
            },
          },
        },
        include: { slots: true },
      });
      const stillPending = updatedPairing.slots.some((s) => s.slotStatus === "PENDING");
      if (!stillPending && updatedPairing.pairingStatus !== "COMPLETE") {
        return tx.padelPairing.update({
          where: { id: pairing.id },
          data: { pairingStatus: "COMPLETE" },
          include: { slots: true },
        });
      }
      return updatedPairing;
    });

    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][open][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
