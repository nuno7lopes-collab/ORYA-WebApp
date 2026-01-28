import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canSwapPartner } from "@/domain/padel/pairingPolicy";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelRegistrationStatus } from "@prisma/client";
import { readNumericParam } from "@/lib/routeParams";
import { randomUUID } from "crypto";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      organizationId: true,
      player1UserId: true,
      player2UserId: true,
      payment_mode: true,
      registration: { select: { status: true } },
      partnerSwapAllowedUntilAt: true,
      slots: true,
    },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Apenas capitão pode trocar parceiro.
  const isCaptain = pairing.player1UserId === authData.user.id;
  if (!isCaptain) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const lifecycleStatus = mapRegistrationToPairingLifecycle(
    pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
    pairing.payment_mode,
  );
  if (!canSwapPartner(lifecycleStatus, new Date(), pairing.partnerSwapAllowedUntilAt)) {
    return jsonWrap({ ok: false, error: "SWAP_NOT_ALLOWED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (!partnerSlot) {
    return jsonWrap({ ok: false, error: "PARTNER_SLOT_MISSING" }, { status: 400 });
  }
  if (partnerSlot.paymentStatus === PadelPairingPaymentStatus.PAID) {
    return jsonWrap({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
  }
  if (partnerSlot.profileId) {
    const now = new Date();
    const swapToken = randomUUID();
    const swapExpiresAt = computeGraceUntil(now);
    const updated = await prisma.padelPairing.update({
      where: { id: pairing.id },
      data: {
        partnerLinkToken: swapToken,
        partnerLinkExpiresAt: swapExpiresAt,
      },
      select: { partnerLinkToken: true, partnerLinkExpiresAt: true },
    });
    return jsonWrap(
      {
        ok: false,
        error: "PARTNER_CONFIRMATION_REQUIRED",
        swapToken: updated.partnerLinkToken,
        swapExpiresAt: updated.partnerLinkExpiresAt?.toISOString() ?? null,
      },
      { status: 409 },
    );
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
            invitedUserId: null,
          },
        },
      },
    },
  });

  return jsonWrap({ ok: true }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);