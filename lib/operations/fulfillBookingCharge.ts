import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge } from "@/domain/finance/gateway/stripeGateway";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { logError } from "@/lib/observability/logger";

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

async function resolveStripeFee(intent: Stripe.PaymentIntent) {
  let stripeFeeCents: number | null = null;
  let stripeChargeId: string | null = null;

  try {
    if (intent.latest_charge) {
      const chargeId =
        typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, { expand: ["balance_transaction"] });
        stripeChargeId = charge.id ?? null;
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
      }
    }
  } catch (err) {
    logError("fulfill_booking_charge.balance_transaction_failed", err, { paymentIntentId: intent.id });
  }

  return { stripeFeeCents, stripeChargeId };
}

export async function fulfillBookingChargeIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const bookingChargeId = parseId(meta.bookingChargeId);
  if (!bookingChargeId) return false;

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;
  const paymentId = typeof meta.paymentId === "string" ? meta.paymentId : null;
  const bookingId = parseId(meta.bookingId);

  const { stripeFeeCents, stripeChargeId } = await resolveStripeFee(intent);

  await prisma.$transaction(async (tx) => {
    const charge = await tx.bookingCharge.findUnique({
      where: { id: bookingChargeId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        bookingId: true,
        currency: true,
        label: true,
        kind: true,
        payerKind: true,
        paymentId: true,
        paymentIntentId: true,
        booking: { select: { userId: true } },
      },
    });

    if (!charge) {
      throw new Error("BOOKING_CHARGE_NOT_FOUND");
    }

    if (charge.status !== "PAID") {
      await tx.bookingCharge.update({
        where: { id: charge.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentIntentId: intent.id,
          paymentId: paymentId ?? charge.paymentId ?? undefined,
        },
      });
    }


    await recordOrganizationAudit(tx, {
      organizationId: charge.organizationId,
      actorUserId: charge.booking?.userId ?? null,
      action: "BOOKING_CHARGE_PAID",
      metadata: {
        bookingId: bookingId ?? charge.bookingId,
        chargeId: charge.id,
        amountCents,
        currency: (intent.currency ?? charge.currency ?? "EUR").toUpperCase(),
        kind: charge.kind,
        payerKind: charge.payerKind,
      },
    });
  });

  return true;
}
