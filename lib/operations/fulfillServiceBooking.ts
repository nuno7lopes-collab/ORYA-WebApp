import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge } from "@/domain/finance/gateway/stripeGateway";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";

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
  const organizationId = parseId(meta.organizationId);
  const policyId = parseId(meta.policyId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;

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
    console.warn("[fulfillServiceBooking] falha ao ler balance_transaction", err);
  }

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  if (stripeFeeCents == null) {
    stripeFeeCents = await estimateStripeFee(amountCents);
  }

  let crmPayload:
    | { organizationId: number; userId: string; bookingId: number; amountCents: number; currency: string }
    | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      if (bookingId) {
        const result = await confirmPendingBooking({
          tx,
          bookingId,
          now: new Date(),
          ignoreExpiry: true,
        });

        if (!result.ok) {
          if (result.code === "SLOT_TAKEN") {
            await tx.booking.update({
              where: { id: bookingId },
              data: { status: "CANCELLED_BY_CLIENT" },
            });
          }
          throw new Error(result.code);
        }

        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            serviceId: true,
            organizationId: true,
            userId: true,
            availabilityId: true,
            paymentIntentId: true,
          },
        });

        if (!booking) {
          throw new Error("SERVICE_BOOKING_NOT_FOUND");
        }

        if (!booking.paymentIntentId) {
          await tx.booking.update({
            where: { id: booking.id },
            data: { paymentIntentId: intent.id },
          });
        }

        const existingTransaction = await tx.transaction.findFirst({
          where: { stripePaymentIntentId: intent.id },
          select: { id: true },
        });
        if (!existingTransaction) {
          await tx.transaction.create({
            data: {
              organizationId: organizationId ?? booking.organizationId,
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

        await recordOrganizationAudit(tx, {
          organizationId: organizationId ?? booking.organizationId,
          actorUserId: userId ?? booking.userId,
          action: "BOOKING_CREATED",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            policyId: policyId ?? null,
          },
        });

        crmPayload = {
          organizationId: booking.organizationId,
          userId: userId ?? booking.userId,
          bookingId: booking.id,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
        };
        return;
      }

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

    if (!booking && availabilityWithService && serviceId && organizationId && userId) {
      if (availabilityWithService.serviceId !== serviceId) {
        throw new Error("SERVICE_BOOKING_MISMATCH");
      }
      if (availabilityWithService.status === "CANCELLED") {
        throw new Error("SERVICE_BOOKING_CANCELLED");
      }

      const activeCount = await tx.booking.count({
        where: {
          availabilityId: availabilityWithService.id,
          status: { notIn: ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"] },
        },
      });
      if (activeCount >= availabilityWithService.capacity) {
        throw new Error("SERVICE_BOOKING_FULL");
      }

      booking = await tx.booking.create({
        data: {
          serviceId,
          organizationId,
          userId,
          availabilityId: availabilityWithService.id,
          startsAt: availabilityWithService.startsAt,
          durationMinutes: availabilityWithService.durationMinutes,
          price: availabilityWithService.service.unitPriceCents,
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

    const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status);
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
              where: { id: policyId, organizationId: organizationId ?? booking.organizationId },
              select: { id: true },
            })
          : null) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: organizationId ?? booking.organizationId, policyType: "MODERATE" },
          select: { id: true },
        })) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: organizationId ?? booking.organizationId },
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
          organizationId: organizationId ?? booking.organizationId,
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

    if (!isCancelled && (userId ?? booking.userId)) {
      crmPayload = {
        organizationId: booking.organizationId,
        userId: userId ?? booking.userId,
        bookingId: booking.id,
        amountCents,
        currency: (intent.currency ?? "eur").toUpperCase(),
      };
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
            organizationId: organizationId ?? booking.organizationId,
          },
        },
      });

      await recordOrganizationAudit(tx, {
        organizationId: organizationId ?? booking.organizationId,
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
        organizationId: organizationId ?? booking.organizationId,
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
      where: {
        availabilityId: availability.id,
        status: { notIn: ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"] },
      },
    });
    if (activeCount >= availability.capacity && availability.status !== "FULL") {
      await tx.availability.update({
        where: { id: availability.id },
        data: { status: "FULL" },
      });
    }
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (bookingId && ["SLOT_TAKEN", "INVALID_CAPACITY", "SERVICE_INACTIVE"].includes(code)) {
      if (intent.id) {
        await refundBookingPayment({
          bookingId,
          paymentIntentId: intent.id,
          reason: `CONFIRM_${code}`,
        });
      }
      return true;
    }
    throw err;
  }

  if (crmPayload) {
    try {
      await ingestCrmInteraction({
        organizationId: crmPayload.organizationId,
        userId: crmPayload.userId,
        type: CrmInteractionType.BOOKING_CONFIRMED,
        sourceType: CrmInteractionSource.BOOKING,
        sourceId: String(crmPayload.bookingId),
        occurredAt: new Date(),
        amountCents: crmPayload.amountCents,
        currency: crmPayload.currency,
        metadata: { bookingId: crmPayload.bookingId },
      });
    } catch (err) {
      console.warn("[fulfillServiceBooking] Falha ao criar interação CRM", err);
    }
  }

  return true;
}
