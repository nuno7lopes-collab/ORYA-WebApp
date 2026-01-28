export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPaymentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Capitão assume o resto (SPLIT): apenas validação; checkout deve ser iniciado no cliente.
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true, event: { select: { organizationId: true } } },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.payment_mode !== PadelPaymentMode.SPLIT) {
    return jsonWrap({ ok: false, error: "NOT_SPLIT_MODE" }, { status: 400 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return jsonWrap({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const isCaptain = pairing.createdByUserId === user.id;
  if (!isCaptain) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Verifica se ainda há slot pendente não pago
  const pending = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pending) {
    return jsonWrap({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  // Resposta indica que o cliente deve iniciar checkout do valor remanescente
  return jsonWrap(
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
export const POST = withApiEnvelope(_POST);