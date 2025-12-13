export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPaymentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Capitão assume o resto (SPLIT): apenas validação; checkout deve ser iniciado no cliente.
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = Number(params?.id);
  if (!Number.isFinite(pairingId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true, event: { select: { organizerId: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.paymentMode !== PadelPaymentMode.SPLIT) {
    return NextResponse.json({ ok: false, error: "NOT_SPLIT_MODE" }, { status: 400 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const isCaptain = pairing.createdByUserId === user.id;
  if (!isCaptain) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Verifica se ainda há slot pendente não pago
  const pending = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pending) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  // Resposta indica que o cliente deve iniciar checkout do valor remanescente
  return NextResponse.json(
    {
      ok: false,
      error: "PAYMENT_REQUIRED",
      action: "CHECKOUT_CAPTAIN_REST",
      pairingId,
      slotId: pending.id,
    },
    { status: 402 },
  );
}
