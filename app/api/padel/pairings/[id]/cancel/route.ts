export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingStatus, PadelPairingSlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Cancela pairing Padel v2 (MVP: estados DB; refund efetivo fica para o checkout/refund handler).
// Regras: capitão (created_by_user_id) ou staff OWNER/ADMIN do organizer.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = Number(params?.id);
  if (!Number.isFinite(pairingId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      event: { select: { organizerId: true } },
      slots: true,
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.pairingStatus === PadelPairingStatus.CANCELLED) {
    return NextResponse.json({ ok: true, pairing }, { status: 200 });
  }

  // Capitão (created_by_user_id) ou staff OWNER/ADMIN
  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizerMember.findFirst({
      where: {
        organizerId: pairing.organizerId,
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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Marca slots como cancelados
      await tx.padelPairingSlot.updateMany({
        where: { pairingId },
        data: {
          slotStatus: PadelPairingSlotStatus.CANCELLED,
        },
      });

      // Marca pairing cancelado e remove token para impedir novos claims
      const updatedPairing = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          pairingStatus: PadelPairingStatus.CANCELLED,
          inviteToken: null,
          inviteExpiresAt: null,
          lockedUntil: null,
        },
        include: { slots: true },
      });

      return updatedPairing;
    });

    // Nota: refund efetivo deve ser tratado no fluxo de checkout/refund (Stripe) posterior.
    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][cancel][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
