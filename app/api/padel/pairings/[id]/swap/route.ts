import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canSwapPartner } from "@/domain/padel/pairingPolicy";
import { PadelPairingPaymentStatus, PadelPairingSlotStatus } from "@prisma/client";
import { readNumericParam } from "@/lib/routeParams";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = readNumericParam(params?.id, req, "pairings");
  if (pairingId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      organizerId: true,
      player1UserId: true,
      player2UserId: true,
      lifecycleStatus: true,
      partnerSwapAllowedUntilAt: true,
      slots: true,
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Apenas capitão ou staff do organizer
  const isCaptain = pairing.player1UserId === authData.user.id;
  if (!isCaptain) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (!canSwapPartner(pairing.lifecycleStatus as any, new Date(), pairing.partnerSwapAllowedUntilAt)) {
    return NextResponse.json({ ok: false, error: "SWAP_NOT_ALLOWED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (!partnerSlot) {
    return NextResponse.json({ ok: false, error: "PARTNER_SLOT_MISSING" }, { status: 400 });
  }

  // Liberta o parceiro (slot) sem mexer em pagamentos; fluxos de pagamento devem ser tratados noutra rota
  await prisma.padelPairing.update({
    where: { id: pairing.id },
    data: {
      player2UserId: null,
      partnerAcceptedAt: null,
      partnerPaidAt: null,
      partnerInviteUsedAt: null,
      pairingStatus: "INCOMPLETE",
      slots: {
        update: {
          where: { id: partnerSlot.id },
          data: {
            profileId: null,
            playerProfileId: null,
            ticketId: null,
            slotStatus: PadelPairingSlotStatus.PENDING,
            paymentStatus: PadelPairingPaymentStatus.UNPAID,
            invitedContact: null,
          },
        },
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
