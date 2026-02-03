export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { clampDeadlineHours, computePartnerLinkExpiresAt, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { readNumericParam } from "@/lib/routeParams";
import { upsertActiveHold } from "@/domain/padelPairingHold";
import { queuePairingInvite } from "@/domain/notifications/splitPayments";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import {
  INACTIVE_REGISTRATION_STATUSES,
  mapRegistrationToPairingLifecycle,
  resolveInitialPadelRegistrationStatus,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";

type ReopenMode = "INVITE_PARTNER" | "LOOKING_FOR_PARTNER";

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
  createdByUserId: true,
  pairingStatus: true,
  pairingJoinMode: true,
  isPublicOpen: true,
  payment_mode: true,
  deadlineAt: true,
  graceUntilAt: true,
  guaranteeStatus: true,
  event: {
    select: {
      organizationId: true,
      startsAt: true,
      padelTournamentConfig: { select: { splitDeadlineHours: true } },
    },
  },
  slots: { select: pairingSlotSelect },
  registration: { select: { status: true } },
} satisfies Prisma.PadelPairingSelect;

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const modeRaw = typeof body?.mode === "string" ? body?.mode : "INVITE_PARTNER";
  const mode: ReopenMode = modeRaw === "LOOKING_FOR_PARTNER" ? "LOOKING_FOR_PARTNER" : "INVITE_PARTNER";
  const targetUserId = typeof body?.targetUserId === "string" ? body?.targetUserId : null;
  const invitedContact =
    typeof body?.invitedContact === "string" && body.invitedContact.trim().length > 0
      ? body.invitedContact.trim()
      : null;

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingSelect,
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const isInactiveRegistration =
    pairing.registration?.status ? INACTIVE_REGISTRATION_STATUSES.includes(pairing.registration.status) : false;
  if (pairing.pairingStatus !== "CANCELLED" && !isInactiveRegistration) {
    return jsonWrap({ ok: false, error: "PAIRING_NOT_CANCELLED" }, { status: 409 });
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const membership = await resolveGroupMemberForOrg({
      organizationId: pairing.organizationId,
      userId: user.id,
    });
    isStaff = Boolean(membership && ["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role));
  }
  if (!isCaptain && !isStaff) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  const captainSlot = pairing.slots.find((slot) => slot.slot_role === "CAPTAIN");
  if (!partnerSlot || !captainSlot) {
    return jsonWrap({ ok: false, error: "SLOT_MISSING" }, { status: 400 });
  }

  if (
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    partnerSlot.paymentStatus === PadelPairingPaymentStatus.PAID
  ) {
    return jsonWrap({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
  }

  const now = new Date();
  const clampedDeadlineHours = clampDeadlineHours(pairing.event?.padelTournamentConfig?.splitDeadlineHours ?? undefined);
  const deadlineAt =
    pairing.payment_mode === PadelPaymentMode.SPLIT
      ? computeSplitDeadlineAt(now, pairing.event?.startsAt ?? null, clampedDeadlineHours)
      : null;
  if (pairing.payment_mode === PadelPaymentMode.SPLIT && deadlineAt && deadlineAt.getTime() <= now.getTime()) {
    return jsonWrap({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const captainPaid = captainSlot.paymentStatus === PadelPairingPaymentStatus.PAID;
  const nextRegistrationStatus = resolveInitialPadelRegistrationStatus({
    pairingJoinMode: mode === "LOOKING_FOR_PARTNER" ? "LOOKING_FOR_PARTNER" : "INVITE_PARTNER",
    paymentMode: pairing.payment_mode,
    captainPaid,
  });

  const inviteToken = mode === "INVITE_PARTNER" ? randomUUID() : null;
  const linkExpiresAt = inviteToken ? computePartnerLinkExpiresAt(now, undefined) : null;
  const partnerPaymentStatus =
    pairing.payment_mode === PadelPaymentMode.FULL
      ? captainPaid
        ? PadelPairingPaymentStatus.PAID
        : PadelPairingPaymentStatus.UNPAID
      : PadelPairingPaymentStatus.UNPAID;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPairing = await tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        pairingStatus: "INCOMPLETE",
        pairingJoinMode: mode,
        isPublicOpen: mode === "LOOKING_FOR_PARTNER",
        partnerInviteToken: inviteToken,
        partnerLinkToken: inviteToken,
        partnerLinkExpiresAt: linkExpiresAt,
        partnerInvitedAt: inviteToken ? now : null,
        partnerSwapAllowedUntilAt: deadlineAt,
        deadlineAt,
        lockedUntil: null,
        player2UserId: null,
        partnerAcceptedAt: null,
        partnerPaidAt: null,
        partnerInviteUsedAt: null,
        graceUntilAt: null,
        guaranteeStatus: pairing.payment_mode === PadelPaymentMode.SPLIT ? "ARMED" : "NONE",
        slots: {
          update: [
            {
              where: { id: captainSlot.id },
              data: {
                slotStatus: captainPaid ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING,
                paymentStatus: captainPaid ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
              },
            },
            {
              where: { id: partnerSlot.id },
              data: {
                profileId: null,
                playerProfileId: null,
                invitedUserId: mode === "INVITE_PARTNER" ? targetUserId : null,
                invitedContact: mode === "INVITE_PARTNER" ? invitedContact : null,
                slotStatus: PadelPairingSlotStatus.PENDING,
                paymentStatus: partnerPaymentStatus,
              },
            },
          ],
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

    if (pairing.payment_mode === PadelPaymentMode.SPLIT) {
      await upsertActiveHold(tx, { pairingId: pairing.id, eventId: pairing.eventId, ttlMinutes: 30 });
    }

    return updatedPairing;
  });

  if (inviteToken && targetUserId) {
    await queuePairingInvite({
      pairingId,
      targetUserId,
      inviterUserId: user.id,
      token: inviteToken,
    });
  }

  const lifecycleStatus = mapRegistrationToPairingLifecycle(nextRegistrationStatus, pairing.payment_mode);
  return jsonWrap(
    {
      ok: true,
      pairing: { ...updated, lifecycleStatus },
      inviteToken,
      mode,
    },
    { status: 200 },
  );
}
export const POST = withApiEnvelope(_POST);
