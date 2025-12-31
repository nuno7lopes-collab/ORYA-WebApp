import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

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

export async function fulfillServiceBookingIntent(
  intent: Stripe.PaymentIntent,
): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const isServiceBooking =
    meta.serviceBooking === "1" ||
    meta.serviceBooking === "true" ||
    Boolean(meta.bookingId) ||
    Boolean(meta.serviceId);
  if (!isServiceBooking) return false;

  const bookingId = parseId(meta.bookingId);
  const serviceId = parseId(meta.serviceId);
  const availabilityId = parseId(meta.availabilityId);
  const organizerId = parseId(meta.organizerId);
  const policyId = parseId(meta.policyId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;

  let stripeFeeCents: number | null = null;
  let stripeChargeId: string | null = null;
  try {
    if (intent.latest_charge) {
      const charge = await stripe.charges.retrieve(intent.latest_charge as string, {
        expand: ["balance_transaction"],
      });
      stripeChargeId = charge.id ?? null;
      const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
    }
  } catch (err) {
    console.warn("[fulfillServiceBooking] falha ao ler balance_transaction", err);
  }

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  if (stripeFeeCents == null) {
    stripeFeeCents = await estimateStripeFee(amountCents);
  }

  await prisma.$transaction(async (tx) => {
    let booking = bookingId
      ? await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            availability: true,
            policyRef: { select: { policyId: true } },
          },
        })
      : null;

    const availabilityWithService = availabilityId
      ? await tx.availability.findUnique({
          where: { id: availabilityId },
          include: { service: true },
        })
      : null;

    const availability = booking?.availability ?? availabilityWithService;

    if (!booking && availabilityWithService && serviceId && organizerId && userId) {
      if (availabilityWithService.serviceId !== serviceId) {
        throw new Error("SERVICE_BOOKING_MISMATCH");
      }
      if (availabilityWithService.status === "CANCELLED") {
        throw new Error("SERVICE_BOOKING_CANCELLED");
      }

      const activeCount = await tx.booking.count({
        where: { availabilityId: availabilityWithService.id, status: { not: "CANCELLED" } },
      });
      if (activeCount >= availabilityWithService.capacity) {
        throw new Error("SERVICE_BOOKING_FULL");
      }

      booking = await tx.booking.create({
        data: {
          serviceId,
          organizerId,
          userId,
          availabilityId: availabilityWithService.id,
          startsAt: availabilityWithService.startsAt,
          durationMinutes: availabilityWithService.durationMinutes,
          price: availabilityWithService.service.price,
          currency: availabilityWithService.service.currency,
          status: "CONFIRMED",
          paymentIntentId: intent.id,
        },
        include: {
          availability: true,
          policyRef: { select: { policyId: true } },
        },
      });
    }

    if (!booking || !availability) {
      throw new Error("SERVICE_BOOKING_NOT_FOUND");
    }

    const isCancelled = booking.status === "CANCELLED";
    const confirmedNow = !isCancelled && booking.status !== "CONFIRMED";
    if (confirmedNow) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", paymentIntentId: intent.id },
      });
    } else if (!booking.paymentIntentId) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentIntentId: intent.id },
      });
    }

    if (!booking.policyRef) {
      const policy =
        (policyId
          ? await tx.organizationPolicy.findFirst({
              where: { id: policyId, organizerId: organizerId ?? booking.organizerId },
              select: { id: true },
            })
          : null) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizerId: organizerId ?? booking.organizerId, policyType: "MODERATE" },
          select: { id: true },
        })) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizerId: organizerId ?? booking.organizerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }));

      if (policy) {
        await tx.bookingPolicyRef.create({
          data: { bookingId: booking.id, policyId: policy.id },
        });
      }
    }

    const existingTransaction = await tx.transaction.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true },
    });
    if (!existingTransaction) {
      await tx.transaction.create({
        data: {
          organizerId: organizerId ?? booking.organizerId,
          userId: userId ?? booking.userId,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
          stripeChargeId,
          stripePaymentIntentId: intent.id,
          platformFeeCents,
          stripeFeeCents: stripeFeeCents ?? 0,
          payoutStatus: "PENDING",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
          },
        },
      });
    }

    if (confirmedNow && (userId ?? booking.userId)) {
      await tx.userActivity.create({
        data: {
          userId: userId ?? booking.userId,
          type: "BOOKING_CREATED",
          visibility: "PRIVATE",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            organizerId: organizerId ?? booking.organizerId,
          },
        },
      });

      await recordOrganizationAudit(tx, {
        organizerId: organizerId ?? booking.organizerId,
        actorUserId: userId ?? booking.userId,
        action: "BOOKING_CREATED",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          policyId: policyId ?? null,
        },
      });
    } else if (isCancelled) {
      await recordOrganizationAudit(tx, {
        organizerId: organizerId ?? booking.organizerId,
        actorUserId: userId ?? booking.userId,
        action: "BOOKING_PAYMENT_AFTER_CANCEL",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          paymentIntentId: intent.id,
        },
      });
    }

    const activeCount = await tx.booking.count({
      where: { availabilityId: availability.id, status: { not: "CANCELLED" } },
    });
    if (activeCount >= availability.capacity && availability.status !== "FULL") {
      await tx.availability.update({
        where: { id: availability.id },
        data: { status: "FULL" },
      });
    }
  });

  return true;
}
