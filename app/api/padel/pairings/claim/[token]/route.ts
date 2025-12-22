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
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { validateEligibility } from "@/domain/padelEligibility";
import { PairingAction, transition } from "@/domain/padelPairingStateMachine";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";

async function ensurePlayerProfile(params: { organizerId: number; userId: string }) {
  const { organizerId, userId } = params;
  const existing = await prisma.padelPlayerProfile.findFirst({
    where: { organizerId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
  const name = profile?.fullName?.trim() || "Jogador Padel";
  const email = profile?.email || null;
  const created = await prisma.padelPlayerProfile.create({
    data: {
      organizerId,
      userId,
      fullName: name,
      displayName: name,
      email: email ?? undefined,
    },
    select: { id: true },
  });
  return created.id;
}

// Claim endpoint para convites (Padel v2).
export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerInviteToken: token },
    select: {
      id: true,
      pairingStatus: true,
      lifecycleStatus: true,
      partnerLinkExpiresAt: true,
      lockedUntil: true,
      payment_mode: true,
      eventId: true,
      organizerId: true,
      player1UserId: true,
      player2UserId: true,
      deadlineAt: true,
      slots: {
        select: {
          id: true,
          slotStatus: true,
          paymentStatus: true,
          profileId: true,
          invitedContact: true,
          slot_role: true,
        },
      },
    },
  });

  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.partnerLinkExpiresAt && pairing.partnerLinkExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });
  }
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: pairing.eventId, status: "ON_SALE" },
    select: { id: true, name: true, price: true, currency: true },
    orderBy: { price: "asc" },
  });

  const padelEvent = await buildPadelEventSnapshot(pairing.eventId);

  const pairingPayload = {
    ...pairing,
    paymentMode: pairing.payment_mode,
    slots: pairing.slots.map(({ slot_role, ...slotRest }) => ({
      ...slotRest,
      slotRole: slot_role,
    })),
  };
  return NextResponse.json(
    { ok: true, pairing: pairingPayload, ticketTypes, organizerId: pairing.organizerId, status: "PREVIEW_ONLY", padelEvent },
    { status: 200 },
  );
}

export async function POST(_: NextRequest, { params }: { params: { token: string } }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const token = params?.token;
  if (!token) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerInviteToken: token },
    include: { slots: true },
  });

  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.partnerLinkExpiresAt && pairing.partnerLinkExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });
  }
  if (pairing.lifecycleStatus === "CANCELLED_INCOMPLETE" || pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  // SPLIT sem pagamento do parceiro: devolve ação para checkout
  if (pairing.payment_mode === PadelPaymentMode.SPLIT && pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
    return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_PARTNER" }, { status: 402 });
  }
  if (pairing.payment_mode === PadelPaymentMode.FULL) {
    const captainSlot = pairing.slots.find((s) => s.slot_role === "CAPTAIN");
    if (!captainSlot || captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
    if (pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
  }
  if (pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "PAIRING_EXPIRED" }, { status: 410 });
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

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.eventId },
    select: { eligibilityType: true },
  });

  const [captainProfile, partnerProfile] = await Promise.all([
    pairing.player1UserId
      ? prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
      : Promise.resolve(null),
    prisma.profile.findUnique({ where: { id: user.id }, select: { gender: true } }),
  ]);

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

  try {
    const playerProfileId = await ensurePlayerProfile({ organizerId: pairing.organizerId, userId: user.id });
    const { pairing: updated, shouldEnsureEntries } = await prisma.$transaction(async (tx) => {
      // Se já tem ticket, validar apropriação
      if (pendingSlot.ticketId) {
        const ticket = await tx.ticket.findUnique({ where: { id: pendingSlot.ticketId } });
        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        if (ticket.userId && ticket.userId !== user.id) throw new Error("TICKET_ALREADY_CLAIMED");

        await tx.ticket.update({
          where: { id: pendingSlot.ticketId },
          data: { userId: user.id },
        });
      }

      const action: PairingAction =
        pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? "PARTNER_PAID" : "PARTNER_ASSIGNED";
      const nextStatus = transition(
        (pairing.lifecycleStatus as PadelPairingLifecycleStatus) ?? "PENDING_ONE_PAID",
        action,
      );
      const partnerAcceptedAt = new Date();
      const partnerPaidAt =
        pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? new Date() : null;

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
                playerProfileId,
                slotStatus: PadelPairingSlotStatus.FILLED,
                paymentStatus: pendingSlot.paymentStatus,
              },
            },
          },
        },
        include: { slots: true },
      });

      const allFilled = updatedPairing.slots.every((s) => s.slotStatus === "FILLED");
      const allPaid = updatedPairing.slots.every((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
      if (allFilled && allPaid && updatedPairing.pairingStatus !== "COMPLETE") {
        const completed = await tx.padelPairing.update({
          where: { id: pairing.id },
          data: { pairingStatus: "COMPLETE" },
          include: { slots: true },
        });
        return { pairing: completed, shouldEnsureEntries: true };
      }

      return { pairing: updatedPairing, shouldEnsureEntries: allFilled && allPaid };
    });

    if (shouldEnsureEntries) {
      await ensureEntriesForConfirmedPairing(updated.id);
    }

    const pairingPayload = {
      ...updated,
      paymentMode: updated.payment_mode,
      slots: updated.slots.map(({ slot_role, ...slotRest }) => ({
        ...slotRest,
        slotRole: slot_role,
      })),
    };
    return NextResponse.json({ ok: true, pairing: pairingPayload }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "TICKET_ALREADY_CLAIMED") {
      return NextResponse.json({ ok: false, error: "TICKET_ALREADY_CLAIMED" }, { status: 409 });
    }
    console.error("[padel/pairings][claim][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
