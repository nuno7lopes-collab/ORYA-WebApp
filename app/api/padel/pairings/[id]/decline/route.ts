export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPairingPaymentStatus, PadelPairingSlotStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const pairingSlotSelect = {
  id: true,
  slot_role: true,
  slotStatus: true,
  paymentStatus: true,
  invitedUserId: true,
  invitedContact: true,
} satisfies Prisma.PadelPairingSlotSelect;

const pairingSelect = {
  id: true,
  pairingStatus: true,
  player1UserId: true,
  player2UserId: true,
  slots: {
    select: pairingSlotSelect,
  },
} satisfies Prisma.PadelPairingSelect;

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingSelect,
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.pairingStatus === "CANCELLED") {
    return jsonWrap({ ok: true, pairing, idempotentReplay: true }, { status: 200 });
  }

  const partnerSlot = pairing.slots.find((s) => s.slot_role === "PARTNER" && s.slotStatus === "PENDING");
  if (!partnerSlot) {
    return jsonWrap({ ok: true, pairing, idempotentReplay: true }, { status: 200 });
  }
  if (partnerSlot.paymentStatus === "PAID") {
    return jsonWrap({ ok: false, error: "ALREADY_PAID" }, { status: 409 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { username: true },
  });
  const invitedContacts = [
    user.email?.trim() ?? null,
    profile?.username?.trim() ?? null,
    profile?.username ? `@${profile.username}` : null,
  ].filter(Boolean) as string[];

  const isInviteTarget =
    (partnerSlot.invitedUserId && partnerSlot.invitedUserId === user.id) ||
    (partnerSlot.invitedContact &&
      invitedContacts.some(
        (value) => value.toLowerCase() === partnerSlot.invitedContact?.toLowerCase(),
      ));

  if (!isInviteTarget) {
    if (!partnerSlot.invitedUserId && !partnerSlot.invitedContact) {
      return jsonWrap({ ok: true, pairing, idempotentReplay: true }, { status: 200 });
    }
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.update({
      where: { id: partnerSlot.id },
      data: {
        invitedUserId: null,
        invitedContact: null,
        profileId: null,
        slotStatus: PadelPairingSlotStatus.PENDING,
        paymentStatus: PadelPairingPaymentStatus.UNPAID,
      },
    });

    return tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        partnerInviteToken: null,
        partnerLinkToken: null,
        partnerLinkExpiresAt: null,
        partnerInvitedAt: null,
        partnerInviteUsedAt: null,
        partnerAcceptedAt: null,
        partnerPaidAt: null,
        player2UserId: null,
      },
      select: pairingSelect,
    });
  });

  return jsonWrap({ ok: true, pairing: updated, idempotentReplay: false }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
