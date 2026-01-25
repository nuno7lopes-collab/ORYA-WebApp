export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canSwapPartner } from "@/domain/padel/pairingPolicy";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { mapRegistrationToPairingLifecycle, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";

// Confirma troca de parceiro quando o parceiro pago autoriza a saída.
export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolved = await params;
  const token = resolved?.token;
  if (!token) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerLinkToken: token },
    include: { slots: true, registration: { select: { status: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const now = new Date();
  if (pairing.partnerLinkExpiresAt && pairing.partnerLinkExpiresAt.getTime() < now.getTime()) {
    return NextResponse.json({ ok: false, error: "SWAP_CONFIRM_EXPIRED" }, { status: 410 });
  }
  if (pairing.player2UserId !== user.id) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const lifecycleStatus = mapRegistrationToPairingLifecycle(
    pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
    pairing.payment_mode,
  );
  if (!canSwapPartner(lifecycleStatus, now, pairing.partnerSwapAllowedUntilAt)) {
    return NextResponse.json({ ok: false, error: "SWAP_NOT_ALLOWED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (!partnerSlot || partnerSlot.profileId !== user.id) {
    return NextResponse.json({ ok: false, error: "PARTNER_SLOT_MISSING" }, { status: 400 });
  }
  if (partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
    return NextResponse.json({ ok: false, error: "SWAP_NOT_REQUIRED" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (partnerSlot.ticketId) {
      await tx.ticket.updateMany({
        where: { id: partnerSlot.ticketId, userId: user.id },
        data: { userId: null },
      });
    }

    const updated = await tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        player2UserId: null,
        partnerAcceptedAt: null,
        partnerPaidAt: null,
        partnerInviteUsedAt: null,
        partnerInvitedAt: null,
        partnerLinkToken: null,
        partnerLinkExpiresAt: null,
        pairingStatus: "INCOMPLETE",
        slots: {
          update: {
            where: { id: partnerSlot.id },
            data: {
              profileId: null,
              playerProfileId: null,
              invitedContact: null,
              invitedUserId: null,
              slotStatus: PadelPairingSlotStatus.PENDING,
              paymentStatus: PadelPairingPaymentStatus.PAID,
            },
          },
        },
      },
    });

    await upsertPadelRegistrationForPairing(tx, {
      pairingId: updated.id,
      organizationId: updated.organizationId,
      eventId: updated.eventId,
      status: PadelRegistrationStatus.PENDING_PARTNER,
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
