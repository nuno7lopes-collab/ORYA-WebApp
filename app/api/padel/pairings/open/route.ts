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
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";

async function ensurePlayerProfile(params: { organizationId: number; userId: string }) {
  const { organizationId, userId } = params;
  const existing = await prisma.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const [profile, authUser] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } }),
    prisma.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const name = profile?.fullName?.trim() || "Jogador Padel";
  const email = authUser?.email ?? null;
  const created = await prisma.padelPlayerProfile.create({
    data: {
      organizationId,
      userId,
      fullName: name,
      displayName: name,
      email: email ?? undefined,
    },
    select: { id: true },
  });
  return created.id;
}

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
    include: { slots: true, event: { select: { organizationId: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  const organizationId = pairing.event?.organizationId ?? null;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }
  if (pairing.payment_mode === PadelPaymentMode.SPLIT && pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
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
      categoryId: pairing.categoryId ?? undefined,
      OR: [{ player1UserId: user.id }, { player2UserId: user.id }],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
  }

  const limitCheck = await prisma.$transaction((tx) =>
    checkPadelCategoryLimit({
      tx,
      eventId: pairing.eventId,
      userId: user.id,
      categoryId: pairing.categoryId ?? null,
      excludePairingId: pairing.id,
    }),
  );
  if (!limitCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
      },
      { status: 409 },
    );
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
    const playerProfileId = await ensurePlayerProfile({ organizationId, userId: user.id });

    const { pairing: updated, shouldEnsureEntries } = await prisma.$transaction(async (tx) => {
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
                paymentStatus: pendingSlot.paymentStatus,
                playerProfileId,
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
    console.error("[padel/pairings][open][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
