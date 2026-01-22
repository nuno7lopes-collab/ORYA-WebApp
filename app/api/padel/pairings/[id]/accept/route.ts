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
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { checkPadelCategoryPlayerCapacity } from "@/domain/padelCategoryCapacity";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { validateEligibility } from "@/domain/padelEligibility";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { PairingAction, transition } from "@/domain/padelPairingStateMachine";

async function ensurePlayerProfile(params: { organizationId: number; userId: string }) {
  const { organizationId, userId } = params;
  const existing = await prisma.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const [profile, authUser] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    }),
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
      phone: profile?.contactPhone ?? undefined,
      gender: profile?.gender ?? undefined,
      level: profile?.padelLevel ?? undefined,
      preferredSide: profile?.padelPreferredSide ?? undefined,
      clubName: profile?.padelClubName ?? undefined,
    },
    select: { id: true },
  });
  return created.id;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true },
  });

  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.lifecycleStatus === "CANCELLED_INCOMPLETE" || pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }

  const pendingSlot = pairing.slots.find((slot) => slot.slotStatus === "PENDING");
  if (!pendingSlot) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      gender: true,
      fullName: true,
      contactPhone: true,
      padelLevel: true,
      padelPreferredSide: true,
    },
  });
  const invitedContacts = [user.email?.trim() ?? null, profile?.username?.trim() ?? null, profile?.username ? `@${profile.username}` : null]
    .filter(Boolean)
    .map((value) => value?.toLowerCase());
  const invitedMatch =
    (pendingSlot.invitedUserId && pendingSlot.invitedUserId === user.id) ||
    (pendingSlot.invitedContact && invitedContacts.includes(pendingSlot.invitedContact.toLowerCase()));
  if (!invitedMatch) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const [event, windowConfig] = await Promise.all([
    prisma.event.findUnique({
      where: { id: pairing.eventId },
      select: { status: true, startsAt: true },
    }),
    prisma.padelTournamentConfig.findUnique({
      where: { eventId: pairing.eventId },
      select: { advancedSettings: true, eligibilityType: true },
    }),
  ]);
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const advanced = (windowConfig?.advancedSettings || {}) as {
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    competitionState?: string | null;
  };
  const registrationStartsAt =
    advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
      ? new Date(advanced.registrationStartsAt)
      : null;
  const registrationEndsAt =
    advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
      ? new Date(advanced.registrationEndsAt)
      : null;
  const registrationCheck = checkPadelRegistrationWindow({
    eventStatus: event.status,
    eventStartsAt: event.startsAt ?? null,
    registrationStartsAt,
    registrationEndsAt,
    competitionState: advanced.competitionState ?? null,
  });
  if (!registrationCheck.ok) {
    return NextResponse.json({ ok: false, error: registrationCheck.code }, { status: 409 });
  }

  if (
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pairing.deadlineAt &&
    pairing.deadlineAt.getTime() < Date.now() &&
    pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID
  ) {
    return NextResponse.json({ ok: false, error: "PAIRING_EXPIRED" }, { status: 410 });
  }

  if (pairing.payment_mode === PadelPaymentMode.SPLIT && pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
    return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_PARTNER" }, { status: 402 });
  }
  if (pairing.payment_mode === PadelPaymentMode.FULL) {
    const captainSlot = pairing.slots.find((slot) => slot.slot_role === "CAPTAIN");
    if (!captainSlot || captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
    if (pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
  }

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
      { ok: false, error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES" },
      { status: 409 },
    );
  }

  const playerCapacity = await prisma.$transaction((tx) =>
    checkPadelCategoryPlayerCapacity({
      tx,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId ?? null,
    }),
  );
  if (!playerCapacity.ok) {
    return NextResponse.json({ ok: false, error: playerCapacity.code }, { status: 409 });
  }

  const onboardingMissing = getPadelOnboardingMissing({ profile, email: user.email ?? null });
  if (!isPadelOnboardingComplete(onboardingMissing)) {
    return NextResponse.json({ ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: onboardingMissing }, { status: 409 });
  }

  const captainProfile = pairing.player1UserId
    ? await prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
    : null;
  const eligibility = validateEligibility(
    (windowConfig?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    (captainProfile?.gender as Gender | null) ?? null,
    (profile?.gender as Gender | null) ?? null,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  const category = pairing.categoryId
    ? await prisma.padelCategory.findUnique({
        where: { id: pairing.categoryId },
        select: { genderRestriction: true, minLevel: true, maxLevel: true },
      })
    : null;
  const categoryAccess = validatePadelCategoryAccess({
    genderRestriction: category?.genderRestriction ?? null,
    minLevel: category?.minLevel ?? null,
    maxLevel: category?.maxLevel ?? null,
    playerGender: (profile?.gender as Gender | null) ?? null,
    partnerGender: (captainProfile?.gender as Gender | null) ?? null,
    playerLevel: profile?.padelLevel ?? null,
  });
  if (!categoryAccess.ok) {
    if (categoryAccess.code === "GENDER_REQUIRED_FOR_CATEGORY" || categoryAccess.code === "LEVEL_REQUIRED_FOR_CATEGORY") {
      return NextResponse.json(
        { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: categoryAccess.missing },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: categoryAccess.code }, { status: 409 });
  }

  try {
    const playerProfileId = await ensurePlayerProfile({ organizationId: pairing.organizationId, userId: user.id });
    const { pairing: updated, shouldEnsureEntries } = await prisma.$transaction(async (tx) => {
      if (pendingSlot.ticketId) {
        const ticket = await tx.ticket.findUnique({ where: { id: pendingSlot.ticketId } });
        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        if (ticket.userId && ticket.userId !== user.id) throw new Error("TICKET_ALREADY_CLAIMED");
        await tx.ticket.update({ where: { id: pendingSlot.ticketId }, data: { userId: user.id } });
      }

      const slotClaim = await tx.padelPairingSlot.updateMany({
        where: {
          id: pendingSlot.id,
          slotStatus: PadelPairingSlotStatus.PENDING,
          profileId: null,
        },
        data: {
          ticketId: pendingSlot.ticketId ?? undefined,
          profileId: user.id,
          playerProfileId,
          slotStatus: PadelPairingSlotStatus.FILLED,
          paymentStatus: pendingSlot.paymentStatus,
        },
      });
      if (slotClaim.count === 0) {
        throw new Error("SLOT_ALREADY_CLAIMED");
      }

      const action: PairingAction =
        pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? "PARTNER_PAID" : "PARTNER_ASSIGNED";
      const nextStatus = transition(
        (pairing.lifecycleStatus as PadelPairingLifecycleStatus) ?? "PENDING_ONE_PAID",
        action,
      );
      const partnerAcceptedAt = new Date();
      const partnerPaidAt = pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID ? new Date() : null;

      await tx.padelPairing.update({
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
        },
      });

      const updatedPairing = await tx.padelPairing.findUnique({
        where: { id: pairing.id },
        include: { slots: true },
      });
      if (!updatedPairing) throw new Error("PAIRING_NOT_FOUND");

      const allFilled = updatedPairing.slots.every((slot) => slot.slotStatus === "FILLED");
      const allPaid = updatedPairing.slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);
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

    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "TICKET_ALREADY_CLAIMED") {
      return NextResponse.json({ ok: false, error: "TICKET_ALREADY_CLAIMED" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "SLOT_ALREADY_CLAIMED") {
      return NextResponse.json({ ok: false, error: "SLOT_ALREADY_CLAIMED" }, { status: 409 });
    }
    console.error("[padel/pairings][accept][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
