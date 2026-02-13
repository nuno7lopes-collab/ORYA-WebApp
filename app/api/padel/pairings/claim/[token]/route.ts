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
  PadelRegistrationStatus,
} from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { validateEligibility } from "@/domain/padelEligibility";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import {
  checkPadelRegistrationWindow,
  INACTIVE_REGISTRATION_STATUSES,
  mapRegistrationToPairingLifecycle,
  resolvePartnerActionStatus,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";
import { checkPadelCategoryPlayerCapacity } from "@/domain/padelCategoryCapacity";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { ensurePadelPlayerProfileId } from "@/domain/padel/playerProfile";
import { ensurePadelRatingActionAllowed } from "@/app/api/padel/_ratingGate";

const ensurePlayerProfile = (params: { organizationId: number; userId: string }) =>
  ensurePadelPlayerProfileId(prisma, params);

// Claim endpoint para convites (Padel v2).
async function _GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolved = await params;
  const token = resolved?.token;
  if (!token) return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerInviteToken: token },
    select: {
      id: true,
      pairingStatus: true,
      registration: { select: { status: true } },
      partnerLinkExpiresAt: true,
      lockedUntil: true,
      payment_mode: true,
      eventId: true,
      organizationId: true,
      categoryId: true,
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

  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.player2UserId) {
    return jsonWrap({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
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

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return jsonWrap({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }
  if (
    pairing.partnerLinkExpiresAt &&
    pairing.partnerLinkExpiresAt.getTime() < Date.now() &&
    pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID
  ) {
    return jsonWrap({ ok: false, error: "INVITE_EXPIRED" }, { status: 409 });
  }

  const categoryLinks = await prisma.padelEventCategoryLink.findMany({
    where: {
      eventId: pairing.eventId,
      isEnabled: true,
      ...(pairing.categoryId ? { padelCategoryId: pairing.categoryId } : {}),
    },
    select: {
      id: true,
      padelCategoryId: true,
      pricePerPlayerCents: true,
      currency: true,
      format: true,
      category: { select: { label: true } },
    },
    orderBy: { pricePerPlayerCents: "asc" },
  });

  const categoryLinksPayload = categoryLinks.map((link) => ({
    id: link.id,
    name: link.category?.label ?? `Categoria ${link.padelCategoryId}`,
    price: link.pricePerPlayerCents ?? 0,
    currency: link.currency ?? "EUR",
    padelCategoryId: link.padelCategoryId,
    format: link.format ?? null,
  }));
  const ticketTypes = categoryLinksPayload;

  const padelEvent = await buildPadelEventSnapshot(pairing.eventId);

  const previewLifecycle = mapRegistrationToPairingLifecycle(
    pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
    pairing.payment_mode,
  );
  const pairingPayload = {
    ...pairing,
    lifecycleStatus: previewLifecycle,
    paymentMode: pairing.payment_mode,
    slots: pairing.slots.map(({ slot_role, ...slotRest }) => ({
      ...slotRest,
      slotRole: slot_role,
    })),
  };
  return jsonWrap(
    {
      ok: true,
      pairing: pairingPayload,
      categoryLinks: categoryLinksPayload,
      ticketTypes,
      organizationId: pairing.organizationId,
      status: "PREVIEW_ONLY",
      padelEvent,
    },
    { status: 200 },
  );
}

async function _POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const resolved = await params;
  const token = resolved?.token;
  if (!token) return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerInviteToken: token },
    include: { slots: true, registration: { select: { status: true } } },
  });

  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  const ratingGate = await ensurePadelRatingActionAllowed({
    organizationId: pairing.organizationId,
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
  const isInactiveRegistration =
    pairing.registration?.status ? INACTIVE_REGISTRATION_STATUSES.includes(pairing.registration.status) : false;
  if (isInactiveRegistration || pairing.pairingStatus === "CANCELLED") {
    return jsonWrap({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }
  if (pairing.player2UserId) {
    return jsonWrap({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
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

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return jsonWrap({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }
  if (
    pairing.partnerLinkExpiresAt &&
    pairing.partnerLinkExpiresAt.getTime() < Date.now() &&
    pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID
  ) {
    return jsonWrap({ ok: false, error: "INVITE_EXPIRED" }, { status: 409 });
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

  const eligibilityConfig = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.eventId },
    select: { eligibilityType: true },
  });

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

  try {
    const playerProfileId = await ensurePlayerProfile({ organizationId: pairing.organizationId, userId: user.id });
    const { pairing: updated, shouldEnsureEntries, nextRegistrationStatus } = await prisma.$transaction(async (tx) => {
      const nextRegistrationStatus = resolvePartnerActionStatus({
        partnerPaid: pendingSlot.paymentStatus === PadelPairingPaymentStatus.PAID,
      });
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
          include: { slots: true },
        });
        return { pairing: completed, shouldEnsureEntries: true, nextRegistrationStatus };
      }

      return { pairing: updatedPairing, shouldEnsureEntries: allFilled && allPaid, nextRegistrationStatus };
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
    console.error("[padel/pairings][claim][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
