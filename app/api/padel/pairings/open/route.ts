export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  Gender,
  PadelEligibilityType,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  Prisma,
} from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { validateEligibility } from "@/domain/padelEligibility";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { checkPadelCategoryPlayerCapacity } from "@/domain/padelCategoryCapacity";
import {
  checkPadelRegistrationWindow,
  INACTIVE_REGISTRATION_STATUSES,
  mapRegistrationToPairingLifecycle,
  resolvePartnerActionStatus,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { ensurePadelPlayerProfileId } from "@/domain/padel/playerProfile";
import { ensurePadelRatingActionAllowed } from "@/app/api/padel/_ratingGate";

const ensurePlayerProfile = (params: { organizationId: number; userId: string }) =>
  ensurePadelPlayerProfileId(prisma, params);

const pairingSlotSelect = {
  id: true,
  slot_role: true,
  slotStatus: true,
  paymentStatus: true,
  profileId: true,
  invitedUserId: true,
  invitedContact: true,
} satisfies Prisma.PadelPairingSlotSelect;

const pairingSelect = {
  id: true,
  organizationId: true,
  eventId: true,
  categoryId: true,
  player1UserId: true,
  player2UserId: true,
  pairingStatus: true,
  payment_mode: true,
  pairingJoinMode: true,
  isPublicOpen: true,
  deadlineAt: true,
  guaranteeStatus: true,
  graceUntilAt: true,
  event: { select: { organizationId: true } },
  registration: { select: { status: true } },
  slots: { select: pairingSlotSelect },
} satisfies Prisma.PadelPairingSelect;

// Permite um parceiro juntar-se a um pairing com mode LOOKING_FOR_PARTNER / isPublicOpen sem token.
async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const pairingId = typeof body?.pairingId === "number" ? body.pairingId : Number(body?.pairingId);
  if (!Number.isFinite(pairingId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingSelect,
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  const organizationId = pairing.event?.organizationId ?? null;
  if (!organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const ratingGate = await ensurePadelRatingActionAllowed({
    organizationId,
    userId: user.id,
  });
  if (!ratingGate.ok) {
    return jsonWrap(
      {
        ok: false,
        error: ratingGate.error,
        blockedUntil: ratingGate.blockedUntil,
      },
      { status: 423 },
    );
  }

  const [event, windowConfig] = await Promise.all([
    prisma.event.findUnique({
      where: { id: pairing.eventId },
      select: { status: true, startsAt: true },
    }),
    prisma.padelTournamentConfig.findUnique({
      where: { eventId: pairing.eventId },
      select: { advancedSettings: true, lifecycleStatus: true },
    }),
  ]);
  if (!event) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
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
    lifecycleStatus: windowConfig?.lifecycleStatus ?? null,
  });
  if (!registrationCheck.ok) {
    return jsonWrap({ ok: false, error: registrationCheck.code }, { status: 409 });
  }
  if (pairing.player2UserId) {
    return jsonWrap({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }
  if (
    pairing.pairingJoinMode !== "LOOKING_FOR_PARTNER" &&
    !pairing.isPublicOpen
  ) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Guard: utilizador já tem pairing ativo no torneio?
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId: pairing.eventId,
      categoryId: pairing.categoryId ?? undefined,
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
        { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
      ],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return jsonWrap({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
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
    return jsonWrap(
      {
        ok: false,
        error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
      },
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
    return jsonWrap({ ok: false, error: playerCapacity.code }, { status: 409 });
  }

  const [captainProfile, partnerProfile] = await Promise.all([
    pairing.player1UserId
      ? prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
      : Promise.resolve(null),
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        gender: true,
        fullName: true,
        username: true,
        contactPhone: true,
        padelLevel: true,
        padelPreferredSide: true,
      },
    }),
  ]);

  const missing = getPadelOnboardingMissing({
    profile: partnerProfile,
    email: user.email ?? null,
  });
  if (!isPadelOnboardingComplete(missing)) {
    return jsonWrap(
      { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing },
      { status: 409 },
    );
  }
  const eligibilityConfig = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.eventId },
    select: { eligibilityType: true },
  });
  const eligibility = validateEligibility(
    (eligibilityConfig?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    (captainProfile?.gender as Gender | null) ?? null,
    partnerProfile?.gender as Gender | null,
  );
  if (!eligibility.ok) {
    return jsonWrap(
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
    playerGender: partnerProfile?.gender as Gender | null,
    partnerGender: captainProfile?.gender as Gender | null,
    playerLevel: partnerProfile?.padelLevel ?? null,
  });
  if (!categoryAccess.ok) {
    if (categoryAccess.code === "GENDER_REQUIRED_FOR_CATEGORY") {
      return jsonWrap(
        { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: categoryAccess.missing },
        { status: 409 },
      );
    }
    return jsonWrap({ ok: false, error: categoryAccess.code }, { status: 409 });
  }
  if (categoryAccess.warning === "LEVEL_REQUIRED_FOR_CATEGORY") {
    return jsonWrap(
      { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: categoryAccess.missing },
      { status: 409 },
    );
  }

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return jsonWrap({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }
  const nowTs = Date.now();
  const graceExpired =
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pairing.graceUntilAt &&
    pairing.graceUntilAt.getTime() < nowTs;
  const deadlineExpired =
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pairing.deadlineAt &&
    pairing.deadlineAt.getTime() < nowTs;
  if (
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID &&
    (graceExpired || deadlineExpired)
  ) {
    return jsonWrap({ ok: false, error: "PAIRING_EXPIRED" }, { status: 409 });
  }
  if (pairing.payment_mode === PadelPaymentMode.FULL) {
    const captainSlot = pairing.slots.find((s) => s.slot_role === "CAPTAIN");
    if (!captainSlot || captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return jsonWrap({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
    if (pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      return jsonWrap({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_CAPTAIN" }, { status: 402 });
    }
  }

  try {
    const nextRegistrationStatus = resolvePartnerActionStatus({
      partnerPaid: pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID,
    });
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
        select: pairingSelect,
      });

      await upsertPadelRegistrationForPairing(tx, {
        pairingId: updatedPairing.id,
        organizationId: updatedPairing.organizationId,
        eventId: updatedPairing.eventId,
        status: nextRegistrationStatus,
      });

      const allFilled = updatedPairing.slots.every((s) => s.slotStatus === "FILLED");
      const allPaid = updatedPairing.slots.every((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
      if (allFilled && allPaid && updatedPairing.pairingStatus !== "COMPLETE") {
        const completed = await tx.padelPairing.update({
          where: { id: pairing.id },
          data: { pairingStatus: "COMPLETE" },
          select: pairingSelect,
        });
        return { pairing: completed, shouldEnsureEntries: true };
      }
      return { pairing: updatedPairing, shouldEnsureEntries: allFilled && allPaid };
    });

    if (shouldEnsureEntries) {
      await ensureEntriesForConfirmedPairing(updated.id);
    }

    const lifecycleStatus = mapRegistrationToPairingLifecycle(nextRegistrationStatus, pairing.payment_mode);
    const pairingPayload = {
      ...updated,
      lifecycleStatus,
      paymentMode: updated.payment_mode,
      slots: updated.slots.map(({ slot_role, ...slotRest }) => ({
        ...slotRest,
        slotRole: slot_role,
      })),
    };
    return jsonWrap({ ok: true, pairing: pairingPayload }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][open][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
