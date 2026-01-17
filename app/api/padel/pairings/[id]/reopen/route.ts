export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { clampDeadlineHours, computePartnerLinkExpiresAt, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { readNumericParam } from "@/lib/routeParams";
import { upsertActiveHold } from "@/domain/padelPairingHold";
import { queuePairingInvite } from "@/domain/notifications/splitPayments";

type ReopenMode = "INVITE_PARTNER" | "LOOKING_FOR_PARTNER";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

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
    include: {
      event: {
        select: {
          organizationId: true,
          startsAt: true,
          padelTournamentConfig: { select: { splitDeadlineHours: true } },
        },
      },
      slots: true,
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.pairingStatus !== "CANCELLED" && pairing.lifecycleStatus !== "CANCELLED_INCOMPLETE") {
    return NextResponse.json({ ok: false, error: "PAIRING_NOT_CANCELLED" }, { status: 409 });
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

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  const captainSlot = pairing.slots.find((slot) => slot.slot_role === "CAPTAIN");
  if (!partnerSlot || !captainSlot) {
    return NextResponse.json({ ok: false, error: "SLOT_MISSING" }, { status: 400 });
  }

  if (
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    partnerSlot.paymentStatus === PadelPairingPaymentStatus.PAID
  ) {
    return NextResponse.json({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
  }

  const now = new Date();
  const clampedDeadlineHours = clampDeadlineHours(pairing.event?.padelTournamentConfig?.splitDeadlineHours ?? undefined);
  const deadlineAt =
    pairing.payment_mode === PadelPaymentMode.SPLIT
      ? computeSplitDeadlineAt(now, pairing.event?.startsAt ?? null, clampedDeadlineHours)
      : null;
  if (pairing.payment_mode === PadelPaymentMode.SPLIT && deadlineAt && deadlineAt.getTime() <= now.getTime()) {
    return NextResponse.json({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const captainPaid = captainSlot.paymentStatus === PadelPairingPaymentStatus.PAID;
  const nextLifecycle = captainPaid
    ? pairing.payment_mode === PadelPaymentMode.FULL
      ? PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL
      : PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT
    : PadelPairingLifecycleStatus.PENDING_ONE_PAID;

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
        lifecycleStatus: nextLifecycle,
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
      include: { slots: true },
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

  return NextResponse.json(
    {
      ok: true,
      pairing: updated,
      inviteToken,
      mode,
    },
    { status: 200 },
  );
}
