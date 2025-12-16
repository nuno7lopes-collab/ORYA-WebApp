export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import {
  Prisma,
  PadelPairingStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingLifecycleStatus,
  TicketStatus,
} from "@prisma/client";
import { expireHolds } from "@/domain/padelPairingHold";
import { computeGraceUntil } from "@/domain/padelDeadlines";

// Expira pairings SPLIT com locked_until ultrapassado: cancela slots e tenta refund do capitão.
// Pode ser executado via cron. Não expõe dados sensíveis, mas requer permissão server-side.
export async function POST() {
  const now = new Date();
  await prisma.$transaction((tx) => expireHolds(tx, now));

  // Tentativa de cobrança off-session do capitão (Modelo A) quando deadline expirou e parceiro não pagou
  const chargeable = await prisma.padelPairing.findMany({
    where: {
      deadlineAt: { lt: now },
      payment_mode: "SPLIT",
      lifecycleStatus: PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT,
      guaranteeStatus: { in: ["ARMED", "SCHEDULED"] },
    },
    include: {
      slots: { include: { ticket: true } },
    },
  });

  for (const pairing of chargeable) {
    const paymentMethodId = pairing.paymentMethodId;
    const paidSlot = pairing.slots.find(
      (s) => s.paymentStatus === PadelPairingPaymentStatus.PAID && s.ticket,
    );
    const paidTicket = paidSlot?.ticket;
    const amount =
      (paidTicket?.totalPaidCents ?? 0) > 0
        ? paidTicket!.totalPaidCents
        : paidTicket?.pricePaid ?? 0;
    const currency = (paidTicket?.currency ?? "EUR").toUpperCase();

    if (!paymentMethodId || !amount || amount <= 0) {
      await prisma.padelPairing.update({
        where: { id: pairing.id },
        data: {
          guaranteeStatus: "FAILED",
          lifecycleStatus: "CANCELLED_INCOMPLETE",
          pairingStatus: PadelPairingStatus.CANCELLED,
        },
      });
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          pairingId: pairing.id,
          eventId: pairing.eventId,
          scenario: "GROUP_SPLIT_SECOND_CHARGE",
        },
      });

      if (intent.status === "succeeded") {
        await prisma.$transaction(async (tx) => {
          await tx.padelPairingSlot.updateMany({
            where: { pairingId: pairing.id, slotStatus: PadelPairingSlotStatus.PENDING },
            data: { paymentStatus: PadelPairingPaymentStatus.PAID },
          });
          await tx.padelPairing.update({
            where: { id: pairing.id },
            data: {
              lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
              pairingStatus: PadelPairingStatus.COMPLETE,
              guaranteeStatus: "SUCCEEDED",
              secondChargePaymentIntentId: intent.id,
              captainSecondChargedAt: new Date(),
              partnerPaidAt: new Date(),
              graceUntilAt: null,
            },
          });
          await tx.padelPairingHold.updateMany({
            where: { pairingId: pairing.id, status: "ACTIVE" },
            data: { status: "CANCELLED" },
          });
        });
      } else if (intent.status === "requires_action") {
        await prisma.padelPairing.update({
          where: { id: pairing.id },
          data: {
            guaranteeStatus: "REQUIRES_ACTION",
            secondChargePaymentIntentId: intent.id,
            graceUntilAt: computeGraceUntil(now),
          },
        });
      } else {
        await prisma.padelPairing.update({
          where: { id: pairing.id },
          data: {
            guaranteeStatus: "FAILED",
            lifecycleStatus: "CANCELLED_INCOMPLETE",
            pairingStatus: PadelPairingStatus.CANCELLED,
            graceUntilAt: null,
          },
        });
      }
    } catch (err) {
      console.error("[padel/cron/expire] second charge error", err);
      await prisma.padelPairing.update({
        where: { id: pairing.id },
        data: {
          guaranteeStatus: "REQUIRES_ACTION",
          graceUntilAt: computeGraceUntil(now),
        },
      });
    }
  }

  // Se REQUIRES_ACTION e graceUntilAt já passou, cancelar pairing e libertar hold
  const toCancel = await prisma.padelPairing.findMany({
    where: {
      guaranteeStatus: "REQUIRES_ACTION",
      graceUntilAt: { lt: now },
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
    },
    select: { id: true },
  });
  for (const p of toCancel) {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairingSlot.updateMany({
        where: { pairingId: p.id, slotStatus: PadelPairingSlotStatus.PENDING },
        data: { slotStatus: PadelPairingSlotStatus.CANCELLED, paymentStatus: PadelPairingPaymentStatus.UNPAID },
      });
      await tx.padelPairing.update({
        where: { id: p.id },
        data: {
          pairingStatus: PadelPairingStatus.CANCELLED,
          lifecycleStatus: PadelPairingLifecycleStatus.CANCELLED_INCOMPLETE,
          partnerInviteToken: null,
          partnerInviteUsedAt: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
          guaranteeStatus: "EXPIRED",
          graceUntilAt: null,
        },
      });
      await tx.padelPairingHold.updateMany({
        where: { pairingId: p.id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
    });
  }

  const expired = (await prisma.padelPairing.findMany({
    where: {
      payment_mode: "SPLIT",
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
  })) as Prisma.PadelPairingGetPayload<{
    include: { slots: { include: { ticket: true } } };
  }>[];

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
          partnerInviteToken: null,
          partnerInviteUsedAt: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
          lockedUntil: null,
        },
      });
    });

    processed += 1;
  }

  return NextResponse.json({ ok: true, processed, now: now.toISOString() });
}
