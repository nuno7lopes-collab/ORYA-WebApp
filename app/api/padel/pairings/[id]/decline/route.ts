export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingPaymentStatus, PadelPairingSlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";

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
  if (pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: true, pairing }, { status: 200 });
  }

  const partnerSlot = pairing.slots.find((s) => s.slot_role === "PARTNER" && s.slotStatus === "PENDING");
  if (!partnerSlot) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_INVITE" }, { status: 400 });
  }
  if (partnerSlot.paymentStatus === "PAID") {
    return NextResponse.json({ ok: false, error: "ALREADY_PAID" }, { status: 409 });
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
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.update({
      where: { id: partnerSlot.id },
      data: {
        invitedUserId: null,
        invitedContact: null,
        profileId: null,
        ticketId: null,
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
      include: { slots: true },
    });
  });

  return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
}
