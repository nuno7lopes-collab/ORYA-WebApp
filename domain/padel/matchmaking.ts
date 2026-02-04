import { prisma } from "@/lib/prisma";
import {
  PadelEligibilityType,
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  type Prisma,
} from "@prisma/client";
import { validateEligibility } from "@/domain/padelEligibility";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { INACTIVE_REGISTRATION_STATUSES, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";

export type MatchmakeResult = {
  matched: number;
  skipped: number;
};

type PairingCandidate = {
  id: number;
  eventId: number;
  organizationId: number;
  categoryId: number | null;
  player1UserId: string | null;
  payment_mode: PadelPaymentMode;
  pairingJoinMode: PadelPairingJoinMode;
  pairingStatus: PadelPairingStatus;
  deadlineAt: Date | null;
  createdAt: Date;
  registration: { status: PadelRegistrationStatus } | null;
  player1: { gender: string | null; padelLevel: string | null; padelPreferredSide: string | null } | null;
  category: { genderRestriction: string | null; minLevel: string | null; maxLevel: string | null } | null;
  slots: Array<{
    id: number;
    slot_role: PadelPairingSlotRole;
    slotStatus: PadelPairingSlotStatus;
    paymentStatus: PadelPairingPaymentStatus;
    ticketId: string | null;
  }>;
};

function isPairingActive(registration: { status: PadelRegistrationStatus } | null) {
  if (!registration) return true;
  return !INACTIVE_REGISTRATION_STATUSES.includes(registration.status);
}

function canUsePairing(candidate: PairingCandidate, now: Date) {
  if (candidate.pairingStatus === "CANCELLED") return false;
  if (!isPairingActive(candidate.registration)) return false;
  if (candidate.payment_mode !== PadelPaymentMode.SPLIT) return false;
  if (candidate.pairingJoinMode !== PadelPairingJoinMode.LOOKING_FOR_PARTNER) return false;
  const partnerSlot = candidate.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.PARTNER);
  if (!partnerSlot || partnerSlot.slotStatus !== PadelPairingSlotStatus.PENDING) return false;
  if (candidate.deadlineAt && candidate.deadlineAt.getTime() < now.getTime()) {
    if (partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) return false;
  }
  return true;
}

function isEligiblePair(params: {
  eligibilityType: PadelEligibilityType;
  host: PairingCandidate;
  partner: PairingCandidate;
}) {
  const { eligibilityType, host, partner } = params;
  const hostGender = (host.player1?.gender as any) ?? null;
  const partnerGender = (partner.player1?.gender as any) ?? null;

  const eligibility = validateEligibility(eligibilityType, hostGender, partnerGender);
  if (!eligibility.ok) return false;

  const category = host.category ?? partner.category ?? null;
  if (category) {
    const hostAccess = validatePadelCategoryAccess({
      genderRestriction: category.genderRestriction,
      minLevel: category.minLevel,
      maxLevel: category.maxLevel,
      playerGender: hostGender,
      partnerGender: partnerGender,
      playerLevel: host.player1?.padelLevel ?? null,
    });
    if (!hostAccess.ok) return false;

    const partnerAccess = validatePadelCategoryAccess({
      genderRestriction: category.genderRestriction,
      minLevel: category.minLevel,
      maxLevel: category.maxLevel,
      playerGender: partnerGender,
      partnerGender: hostGender,
      playerLevel: partner.player1?.padelLevel ?? null,
    });
    if (!partnerAccess.ok) return false;
  }

  return true;
}

function preferenceScore(
  hostSide: string | null | undefined,
  partnerSide: string | null | undefined,
) {
  const hostAny = !hostSide || hostSide === "QUALQUER";
  const partnerAny = !partnerSide || partnerSide === "QUALQUER";
  if (hostAny || partnerAny) return 0;
  if (hostSide === partnerSide) return 1;
  return 0;
}

async function mergePairings(params: {
  tx: Prisma.TransactionClient;
  hostId: number;
  partnerId: number;
  now: Date;
}): Promise<boolean> {
  const { tx, hostId, partnerId, now } = params;
  if (hostId === partnerId) return false;

  const [host, partner] = await Promise.all([
    tx.padelPairing.findUnique({
      where: { id: hostId },
      select: {
        id: true,
        eventId: true,
        organizationId: true,
        categoryId: true,
        player1UserId: true,
        player2UserId: true,
        payment_mode: true,
        pairingStatus: true,
        pairingJoinMode: true,
        deadlineAt: true,
        registration: { select: { status: true } },
        slots: {
          select: {
            id: true,
            slot_role: true,
            slotStatus: true,
            paymentStatus: true,
            ticketId: true,
          },
        },
      },
    }),
    tx.padelPairing.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        eventId: true,
        organizationId: true,
        categoryId: true,
        player1UserId: true,
        player2UserId: true,
        payment_mode: true,
        pairingStatus: true,
        pairingJoinMode: true,
        deadlineAt: true,
        registration: { select: { status: true } },
        slots: {
          select: {
            id: true,
            slot_role: true,
            slotStatus: true,
            paymentStatus: true,
            ticketId: true,
          },
        },
      },
    }),
  ]);

  if (!host || !partner) return false;
  if (host.player2UserId || partner.player2UserId) return false;
  if (host.pairingStatus === "CANCELLED" || partner.pairingStatus === "CANCELLED") return false;
  if (!isPairingActive(host.registration) || !isPairingActive(partner.registration)) return false;

  const hostPartnerSlot = host.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.PARTNER);
  const partnerCaptainSlot = partner.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.CAPTAIN);
  if (!hostPartnerSlot || !partnerCaptainSlot) return false;
  if (hostPartnerSlot.slotStatus !== PadelPairingSlotStatus.PENDING) return false;
  if (hostPartnerSlot.ticketId) return false;

  const partnerUserId = partner.player1UserId;
  if (!partnerUserId) return false;

  const partnerTicketId = partnerCaptainSlot.ticketId;
  const partnerPaid = partnerCaptainSlot.paymentStatus === PadelPairingPaymentStatus.PAID;

  if (partnerTicketId) {
    await tx.padelPairingSlot.update({
      where: { id: partnerCaptainSlot.id },
      data: { ticketId: null },
    });
    await tx.ticket.update({
      where: { id: partnerTicketId },
      data: { pairingId: host.id, userId: partnerUserId },
    });
  }

  await tx.padelPairingSlot.update({
    where: { id: hostPartnerSlot.id },
    data: {
      profileId: partnerUserId,
      invitedUserId: null,
      invitedContact: null,
      slotStatus: PadelPairingSlotStatus.FILLED,
      paymentStatus: partnerPaid ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
      ticketId: partnerTicketId ?? null,
    },
  });

  await tx.padelPairing.update({
    where: { id: host.id },
    data: {
      player2UserId: partnerUserId,
      pairingStatus: PadelPairingStatus.COMPLETE,
      isPublicOpen: false,
      partnerInviteToken: null,
      partnerLinkToken: null,
      partnerLinkExpiresAt: null,
      partnerInviteUsedAt: now,
      partnerAcceptedAt: now,
      partnerPaidAt: partnerPaid ? now : null,
    },
  });

  await tx.padelPairingSlot.updateMany({
    where: { pairingId: partner.id },
    data: {
      slotStatus: PadelPairingSlotStatus.CANCELLED,
      paymentStatus: PadelPairingPaymentStatus.UNPAID,
      ticketId: null,
    },
  });

  await tx.padelPairing.update({
    where: { id: partner.id },
    data: {
      pairingStatus: PadelPairingStatus.CANCELLED,
      partnerInviteToken: null,
      partnerLinkToken: null,
      partnerLinkExpiresAt: null,
      lockedUntil: null,
      graceUntilAt: null,
      isPublicOpen: false,
    },
  });

  await tx.padelPairingHold.updateMany({
    where: { pairingId: partner.id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  const updatedSlots = await tx.padelPairingSlot.findMany({
    where: { pairingId: host.id },
    select: { paymentStatus: true, slotStatus: true },
  });
  const allPaid = updatedSlots.length > 0 && updatedSlots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);
  const nextStatus = allPaid ? PadelRegistrationStatus.CONFIRMED : PadelRegistrationStatus.PENDING_PAYMENT;
  await upsertPadelRegistrationForPairing(tx, {
    pairingId: host.id,
    organizationId: host.organizationId,
    eventId: host.eventId,
    status: nextStatus,
    paymentMode: host.payment_mode,
    isFullyPaid: allPaid,
    reason: "MATCHMAKING_MERGED",
  });
  await upsertPadelRegistrationForPairing(tx, {
    pairingId: partner.id,
    organizationId: partner.organizationId,
    eventId: partner.eventId,
    status: PadelRegistrationStatus.CANCELLED,
    paymentMode: partner.payment_mode,
    reason: "MATCHMAKING_MERGED",
  });

  return true;
}

export async function matchmakeOpenPairings(params: {
  eventId: number;
  categoryId: number | null;
  eligibilityType: PadelEligibilityType;
  now?: Date;
}): Promise<MatchmakeResult> {
  const now = params.now ?? new Date();
  const pairings = (await prisma.padelPairing.findMany({
    where: {
      eventId: params.eventId,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      payment_mode: PadelPaymentMode.SPLIT,
      pairingStatus: { not: PadelPairingStatus.CANCELLED },
      player2UserId: null,
      pairingJoinMode: PadelPairingJoinMode.LOOKING_FOR_PARTNER,
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      registration: { select: { status: true } },
      player1: { select: { gender: true, padelLevel: true, padelPreferredSide: true } },
      category: { select: { genderRestriction: true, minLevel: true, maxLevel: true } },
      slots: {
        select: {
          id: true,
          slot_role: true,
          slotStatus: true,
          paymentStatus: true,
          ticketId: true,
        },
      },
    },
  })) as PairingCandidate[];

  if (pairings.length < 2) return { matched: 0, skipped: pairings.length };

  const candidates = pairings.filter((pairing) => canUsePairing(pairing, now));
  const used = new Set<number>();
  let matched = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const host = candidates[i];
    if (used.has(host.id)) continue;
    let selected: PairingCandidate | null = null;
    let selectedScore = Number.POSITIVE_INFINITY;

    for (let j = i + 1; j < candidates.length; j += 1) {
      const partner = candidates[j];
      if (used.has(partner.id)) continue;
      if (host.player1UserId && partner.player1UserId && host.player1UserId === partner.player1UserId) continue;
      if (host.categoryId !== partner.categoryId) continue;
      if (!isEligiblePair({ eligibilityType: params.eligibilityType, host, partner })) continue;
      const score = preferenceScore(host.player1?.padelPreferredSide, partner.player1?.padelPreferredSide);
      if (!selected || score < selectedScore) {
        selected = partner;
        selectedScore = score;
        if (score === 0) {
          // Perfect/neutral match found; keep earliest in queue.
          break;
        }
      }
    }

    if (!selected) {
      skipped += 1;
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      return mergePairings({ tx, hostId: host.id, partnerId: selected!.id, now });
    });
    if (result) {
      matched += 1;
      used.add(host.id);
      used.add(selected.id);
    } else {
      skipped += 1;
    }
  }

  return { matched, skipped };
}
