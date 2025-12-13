export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { PadelPairingStatus, PadelPairingPaymentStatus, PadelPairingSlotStatus, TicketStatus } from "@prisma/client";

// Expira pairings SPLIT com locked_until ultrapassado: cancela slots e tenta refund do capitão.
// Pode ser executado via cron. Não expõe dados sensíveis, mas requer permissão server-side.
export async function POST() {
  const now = new Date();
  const expired = await prisma.padelPairing.findMany({
    where: {
      paymentMode: "SPLIT",
      pairingStatus: PadelPairingStatus.INCOMPLETE,
      lockedUntil: { lt: now },
    },
    include: {
      slots: {
        include: {
          ticket: true,
        },
      },
    },
  });

  let processed = 0;
  for (const pairing of expired) {
    const paidSlot = pairing.slots.find((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID && s.ticket?.stripePaymentIntentId);
    const paidTicket = paidSlot?.ticket ?? null;

    // Refund simplificado: devolve o valor total do PaymentIntent do capitão (share)
    if (paidTicket?.stripePaymentIntentId) {
      try {
        await stripe.refunds.create({
          payment_intent: paidTicket.stripePaymentIntentId,
        });
      } catch (err) {
        console.error("[padel/cron/expire] refund falhou", err);
        // Continua mesmo assim para não bloquear expirations
      }
    }

    await prisma.$transaction(async (tx) => {
      // Cancelar slots e limpar tickets
      await tx.padelPairingSlot.updateMany({
        where: { pairingId: pairing.id },
        data: {
          slotStatus: PadelPairingSlotStatus.CANCELLED,
          paymentStatus: PadelPairingPaymentStatus.UNPAID,
          ticketId: null,
        },
      });

      if (paidTicket) {
        await tx.ticket.update({
          where: { id: paidTicket.id },
          data: { status: TicketStatus.REFUNDED },
        });
      }

      await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          pairingStatus: PadelPairingStatus.CANCELLED,
          inviteToken: null,
          inviteExpiresAt: null,
          lockedUntil: null,
        },
      });
    });

    processed += 1;
  }

  return NextResponse.json({ ok: true, processed, now: now.toISOString() });
}
