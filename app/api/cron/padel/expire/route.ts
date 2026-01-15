export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { getStripeBaseFees } from "@/lib/platformSettings";
import {
  Prisma,
  PadelPairingStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingLifecycleStatus,
} from "@prisma/client";
import { expireHolds } from "@/domain/padelPairingHold";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { autoChargeKey } from "@/lib/stripe/idempotency";

// Expira pairings SPLIT com locked_until ultrapassado: cancela slots e liberta tickets sem refunds automáticos.
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

  const stripeBaseFees = await getStripeBaseFees();

  for (const pairing of chargeable) {
    if (pairing.secondChargePaymentIntentId) {
      continue;
    }

    const priorAttempts = await prisma.paymentEvent.count({
      where: { dedupeKey: { startsWith: `auto_charge:${pairing.id}:` } },
    });
    if (priorAttempts >= 1) {
      await prisma.padelPairing.update({
        where: { id: pairing.id },
        data: {
          guaranteeStatus: "FAILED",
          lifecycleStatus: "CANCELLED_INCOMPLETE",
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
      });
      continue;
    }

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
    const platformFeeCents = paidTicket?.platformFeeCents ?? 0;
    const stripeFeeEstimateCents =
      amount > 0
        ? Math.max(
            0,
            Math.round((amount * (stripeBaseFees.feeBps ?? 0)) / 10_000) +
              (stripeBaseFees.feeFixedCents ?? 0),
          )
        : 0;
    const payoutAmountCents = Math.max(0, amount - platformFeeCents - stripeFeeEstimateCents);

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
      const attempt = 1;
      const idempotencyKey = autoChargeKey(pairing.id, attempt);
      const event = await prisma.event.findUnique({
        where: { id: pairing.eventId },
        select: { organization: { select: { stripeAccountId: true } } },
      });
      const recipientConnectAccountId = event?.organization?.stripeAccountId ?? "";

      const intent = await stripe.paymentIntents.create(
        {
          amount,
          currency,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            pairingId: pairing.id,
            eventId: pairing.eventId,
            scenario: "GROUP_SPLIT_SECOND_CHARGE",
            idempotencyKey,
            recipientConnectAccountId,
            payoutAmountCents: String(payoutAmountCents),
            grossAmountCents: String(amount),
            platformFeeCents: String(platformFeeCents),
            feeMode: "INCLUDED",
            sourceType: "PADEL_PAIRING",
            sourceId: String(pairing.id),
            currency,
            stripeFeeEstimateCents: String(stripeFeeEstimateCents),
          },
        },
        { idempotencyKey },
      );

      if (intent.status === "succeeded") {
        await prisma.$transaction(async (tx) => {
          await tx.padelPairingSlot.updateMany({
            where: { pairingId: pairing.id, slotStatus: PadelPairingSlotStatus.PENDING },
            data: { paymentStatus: PadelPairingPaymentStatus.PAID },
          });
          const slots = await tx.padelPairingSlot.findMany({
            where: { pairingId: pairing.id },
            select: { slotStatus: true },
          });
          const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === PadelPairingSlotStatus.FILLED);
          await tx.padelPairing.update({
            where: { id: pairing.id },
            data: {
              lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
              pairingStatus: allFilled ? PadelPairingStatus.COMPLETE : PadelPairingStatus.INCOMPLETE,
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
          guaranteeStatus: "FAILED",
          lifecycleStatus: "CANCELLED_INCOMPLETE",
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
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
          data: { pairingId: null },
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
