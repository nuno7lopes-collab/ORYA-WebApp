import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge } from "@/domain/finance/gateway/stripeGateway";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { addCredits } from "@/lib/reservas/credits";

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

async function estimateStripeFee(amountCents: number) {
  const stripeBase = await getStripeBaseFees();
  return Math.max(
    0,
    Math.round((amountCents * (stripeBase.feeBps ?? 0)) / 10_000) +
      (stripeBase.feeFixedCents ?? 0),
  );
}

export async function fulfillServiceCreditPurchaseIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const isCreditPurchase =
    meta.serviceCreditPurchase === "1" ||
    meta.serviceCreditPurchase === "true" ||
    Boolean(meta.units && meta.serviceId);
  if (!isCreditPurchase) return false;

  const serviceId = parseId(meta.serviceId);
  const organizationId = parseId(meta.organizationId);
  const units = parseNumber(meta.units);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;
  const packId = parseId(meta.packId);

  if (!serviceId || !organizationId || !userId || !units || units <= 0) {
    throw new Error("SERVICE_CREDITS_METADATA_INVALID");
  }

  const existingLedger = await prisma.serviceCreditLedger.findFirst({
    where: { paymentIntentId: intent.id, type: "PURCHASE" },
    select: { id: true },
  });
  if (existingLedger) return true;

  let stripeFeeCents: number | null = null;
  let stripeChargeId: string | null = null;
  try {
    if (intent.latest_charge) {
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, {
          expand: ["balance_transaction"],
        });
        stripeChargeId = charge.id ?? null;
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
      }
    }
  } catch (err) {
    console.warn("[fulfillServiceCredits] falha ao ler balance_transaction", err);
  }

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  if (stripeFeeCents == null) {
    stripeFeeCents = await estimateStripeFee(amountCents);
  }

  await prisma.$transaction(async (tx) => {
    const { expiresAt } = await addCredits(tx, {
      userId,
      serviceId,
      units,
      now: new Date(),
    });

    await tx.serviceCreditLedger.create({
      data: {
        userId,
        serviceId,
        paymentIntentId: intent.id,
        changeUnits: units,
        type: "PURCHASE",
        expiresAt,
        metadata: {
          packId,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
        },
      },
    });

    const existingTransaction = await tx.transaction.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true },
    });
    if (!existingTransaction) {
      await tx.transaction.create({
        data: {
          organizationId,
          userId,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
          stripeChargeId,
          stripePaymentIntentId: intent.id,
          platformFeeCents,
          stripeFeeCents: stripeFeeCents ?? 0,
          payoutStatus: "PENDING",
          metadata: {
            serviceId,
            units,
            packId,
          },
        },
      });
    }
  });

  return true;
}
