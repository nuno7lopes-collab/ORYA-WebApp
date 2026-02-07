import { randomUUID } from "crypto";
import {
  Prisma,
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  PadelWaitlistStatus,
} from "@prisma/client";
import { checkPadelCategoryCapacity } from "@/domain/padelCategoryCapacity";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { checkPadelEventCapacity } from "@/domain/padelEventCapacity";
import { computePartnerLinkExpiresAt, computeSplitDeadlineAt, clampDeadlineHours } from "@/domain/padelDeadlines";
import { INACTIVE_REGISTRATION_STATUSES, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";

type UpsertWaitlistParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  organizationId: number;
  categoryId: number;
  userId: string;
  paymentMode: PadelPaymentMode;
  pairingJoinMode: PadelPairingJoinMode;
  invitedContact: string | null;
};

export async function upsertPadelWaitlistEntry(params: UpsertWaitlistParams) {
  const { tx, eventId, organizationId, categoryId, userId, paymentMode, pairingJoinMode, invitedContact } = params;
  const existing = await tx.padelWaitlistEntry.findFirst({
    where: { eventId, categoryId, userId },
  });
  if (existing) {
    return tx.padelWaitlistEntry.update({
      where: { id: existing.id },
      data: {
        status: PadelWaitlistStatus.PENDING,
        paymentMode,
        pairingJoinMode,
        invitedContact,
        promotedPairingId: null,
      },
    });
  }
  return tx.padelWaitlistEntry.create({
    data: {
      eventId,
      organizationId,
      categoryId,
      userId,
      paymentMode,
      pairingJoinMode,
      invitedContact,
      status: PadelWaitlistStatus.PENDING,
    },
  });
}

type PromoteParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  categoryId: number | null;
  eventStartsAt: Date | null;
  splitDeadlineHours?: number | null;
  maxEntriesTotal?: number | null;
};

type PromoteResult =
  | { ok: true; entryId: number; pairingId: number; userId: string; organizationId: number }
  | { ok: false; code: "WAITLIST_EMPTY" | "CATEGORY_FULL" | "CATEGORY_PLAYERS_FULL" | "EVENT_FULL" | "ALREADY_IN_CATEGORY" | "MAX_CATEGORIES" };

export async function promoteNextPadelWaitlistEntry(params: PromoteParams): Promise<PromoteResult> {
  const { tx, eventId, categoryId, eventStartsAt, splitDeadlineHours, maxEntriesTotal } = params;
  const categoryFilter = Number.isFinite(categoryId as number) ? { categoryId: categoryId as number } : {};
  const entry = await tx.padelWaitlistEntry.findFirst({
    where: {
      eventId,
      ...categoryFilter,
      status: PadelWaitlistStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!entry) return { ok: false, code: "WAITLIST_EMPTY" };

  const existingActive = await tx.padelPairing.findFirst({
    where: {
      eventId,
      categoryId: entry.categoryId ?? undefined,
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
        { OR: [{ player1UserId: entry.userId }, { player2UserId: entry.userId }] },
      ],
    },
    select: { id: true },
  });
  if (existingActive) {
    await tx.padelWaitlistEntry.update({
      where: { id: entry.id },
      data: { status: PadelWaitlistStatus.CANCELLED },
    });
    return { ok: false, code: "ALREADY_IN_CATEGORY" };
  }

  const limitCheck = await checkPadelCategoryLimit({
    tx,
    eventId,
    userId: entry.userId,
    categoryId: entry.categoryId ?? null,
  });
  if (!limitCheck.ok) {
    await tx.padelWaitlistEntry.update({
      where: { id: entry.id },
      data: { status: PadelWaitlistStatus.CANCELLED },
    });
    return { ok: false, code: "MAX_CATEGORIES" };
  }

  const eventCapacity = await checkPadelEventCapacity({
    tx,
    eventId,
    maxEntriesTotal,
  });
  if (!eventCapacity.ok) {
    return { ok: false, code: eventCapacity.code };
  }

  const capacityCheck = await checkPadelCategoryCapacity({
    tx,
    eventId,
    categoryId: entry.categoryId ?? null,
  });
  if (!capacityCheck.ok) {
    return { ok: false, code: capacityCheck.code };
  }

  const now = new Date();
  const clampedDeadlineHours = clampDeadlineHours(splitDeadlineHours ?? undefined);
  const deadlineAt = computeSplitDeadlineAt(now, eventStartsAt ?? null, clampedDeadlineHours);
  const isPublicOpen = entry.pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER;
  const partnerInviteToken = entry.pairingJoinMode === PadelPairingJoinMode.INVITE_PARTNER ? randomUUID() : null;
  const partnerLinkExpiresAt = partnerInviteToken ? computePartnerLinkExpiresAt(now, undefined) : null;

  const registrationStatus =
    entry.pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER
      ? PadelRegistrationStatus.MATCHMAKING
      : PadelRegistrationStatus.PENDING_PARTNER;

  const pairing = await tx.padelPairing.create({
    data: {
      eventId,
      organizationId: entry.organizationId,
      categoryId: entry.categoryId ?? null,
      payment_mode: entry.paymentMode,
      createdByUserId: entry.userId,
      player1UserId: entry.userId,
      partnerInviteToken,
      partnerLinkToken: partnerInviteToken,
      partnerLinkExpiresAt,
      partnerInvitedAt: partnerInviteToken ? now : null,
      partnerSwapAllowedUntilAt: deadlineAt,
      deadlineAt,
      guaranteeStatus: entry.paymentMode === "SPLIT" ? "ARMED" : "NONE",
      lockedUntil: null,
      isPublicOpen,
      pairingJoinMode: entry.pairingJoinMode,
      slots: {
        create: [
          {
            profileId: entry.userId,
            invitedContact: null,
            isPublicOpen,
            slot_role: PadelPairingSlotRole.CAPTAIN,
            slotStatus: PadelPairingSlotStatus.PENDING,
            paymentStatus: PadelPairingPaymentStatus.UNPAID,
          },
          {
            profileId: null,
            invitedContact: entry.invitedContact,
            isPublicOpen,
            slot_role: PadelPairingSlotRole.PARTNER,
            slotStatus: PadelPairingSlotStatus.PENDING,
            paymentStatus: PadelPairingPaymentStatus.UNPAID,
          },
        ],
      },
    },
  });

  await upsertPadelRegistrationForPairing(tx, {
    pairingId: pairing.id,
    organizationId: entry.organizationId,
    eventId,
    status: registrationStatus,
    paymentMode: entry.paymentMode,
    reason: "WAITLIST_PROMOTION",
  });

  await tx.padelWaitlistEntry.update({
    where: { id: entry.id },
    data: { status: PadelWaitlistStatus.PROMOTED, promotedPairingId: pairing.id },
  });

  return { ok: true, entryId: entry.id, pairingId: pairing.id, userId: entry.userId, organizationId: entry.organizationId };
}
