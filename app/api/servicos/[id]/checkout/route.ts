export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";

type BookingError =
  | "HORARIO_NOT_FOUND"
  | "SERVICO_INATIVO"
  | "SERVICO_INVALIDO"
  | "HORARIO_PASSADO"
  | "SEM_VAGAS"
  | "JA_RESERVADO"
  | "STRIPE_NOT_READY"
  | "CURRENCY_NOT_SUPPORTED";

const ERROR_MAP: Record<BookingError, { status: number; message: string }> = {
  HORARIO_NOT_FOUND: { status: 404, message: "Horário não encontrado." },
  SERVICO_INATIVO: { status: 400, message: "Serviço inativo." },
  SERVICO_INVALIDO: { status: 400, message: "Serviço indisponível." },
  HORARIO_PASSADO: { status: 400, message: "Este horário já passou." },
  SEM_VAGAS: { status: 409, message: "Sem vagas disponíveis." },
  JA_RESERVADO: { status: 409, message: "Já tens uma reserva para este horário." },
  STRIPE_NOT_READY: { status: 409, message: "Pagamentos indisponíveis para este organização." },
  CURRENCY_NOT_SUPPORTED: { status: 400, message: "Moeda não suportada." },
};

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const serviceId = Number(params.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "SERVICO_INVALIDO" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = await req.json().catch(() => ({}));
    const availabilityId = Number(payload?.availabilityId);
    if (!Number.isFinite(availabilityId)) {
      return NextResponse.json({ ok: false, error: "HORARIO_NOT_FOUND" }, { status: 400 });
    }

    type CheckoutResult =
      | {
          booking: { id: number; status: string };
          service: {
            id: number;
            price: number;
            currency: string;
            organizationId: number;
          };
          availability: { id: number; capacity: number; status: string };
          policy: {
            id: number;
            name: string;
            policyType: string;
            cancellationWindowMinutes: number | null;
          } | null;
          organization: {
            id: number;
            orgType: string | null;
            stripeAccountId: string | null;
            stripeChargesEnabled: boolean | null;
            stripePayoutsEnabled: boolean | null;
            feeMode: string | null;
            platformFeeBps: number | null;
            platformFeeFixedCents: number | null;
          };
          reuseIntentId?: string | null;
        }
      | { error: BookingError };

    const result = await prisma.$transaction<CheckoutResult>(async (tx) => {
      const availability = await tx.availability.findUnique({
        where: { id: availabilityId },
        include: {
          service: {
            select: {
              id: true,
              organizationId: true,
              price: true,
              currency: true,
              durationMinutes: true,
              isActive: true,
              policyId: true,
              policy: {
                select: {
                  id: true,
                  name: true,
                  policyType: true,
                  cancellationWindowMinutes: true,
                },
              },
              organization: {
                select: {
                  id: true,
                  status: true,
                  organizationCategory: true,
                  orgType: true,
                  stripeAccountId: true,
                  stripeChargesEnabled: true,
                  stripePayoutsEnabled: true,
                  feeMode: true,
                  platformFeeBps: true,
                  platformFeeFixedCents: true,
                },
              },
            },
          },
        },
      });

      if (!availability || availability.serviceId !== serviceId) {
        return { error: "HORARIO_NOT_FOUND" as const };
      }

      if (!availability.service?.isActive) {
        return { error: "SERVICO_INATIVO" as const };
      }

      if (
        availability.service.organization.status !== "ACTIVE" ||
        availability.service.organization.organizationCategory !== "RESERVAS"
      ) {
        return { error: "SERVICO_INVALIDO" as const };
      }

      if (availability.status === "CANCELLED") {
        return { error: "SERVICO_INVALIDO" as const };
      }

      if (availability.startsAt < new Date()) {
        return { error: "HORARIO_PASSADO" as const };
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          availabilityId,
          userId: user.id,
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          status: true,
          paymentIntentId: true,
        },
      });

      if (existingBooking?.status === "CONFIRMED") {
        return { error: "JA_RESERVADO" as const };
      }

      if (existingBooking?.status === "PENDING" && existingBooking.paymentIntentId) {
        const policyRef = await tx.bookingPolicyRef.findUnique({
          where: { bookingId: existingBooking.id },
          select: {
            policy: {
              select: {
                id: true,
                name: true,
                policyType: true,
                cancellationWindowMinutes: true,
              },
            },
          },
        });

        return {
          booking: { id: existingBooking.id, status: existingBooking.status },
          service: {
            id: availability.serviceId,
            price: availability.service.price,
            currency: availability.service.currency,
            organizationId: availability.service.organizationId,
          },
          availability: {
            id: availability.id,
            capacity: availability.capacity,
            status: availability.status,
          },
          policy: policyRef?.policy ?? null,
          organization: {
            id: availability.service.organization.id,
            orgType: availability.service.organization.orgType,
            stripeAccountId: availability.service.organization.stripeAccountId,
            stripeChargesEnabled: availability.service.organization.stripeChargesEnabled,
            stripePayoutsEnabled: availability.service.organization.stripePayoutsEnabled,
            feeMode: availability.service.organization.feeMode,
            platformFeeBps: availability.service.organization.platformFeeBps,
            platformFeeFixedCents: availability.service.organization.platformFeeFixedCents,
          },
          reuseIntentId: existingBooking.paymentIntentId,
        };
      }

      if (existingBooking?.status === "PENDING" && !existingBooking.paymentIntentId) {
        await tx.booking.update({
          where: { id: existingBooking.id },
          data: { status: "CANCELLED" },
        });
      }

      const existingCount = await tx.booking.count({
        where: {
          availabilityId,
          status: { not: "CANCELLED" },
        },
      });

      if (existingCount >= availability.capacity) {
        await tx.availability.update({
          where: { id: availabilityId },
          data: { status: "FULL" },
        });
        return { error: "SEM_VAGAS" as const };
      }

      const policy =
        availability.service.policy ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: availability.service.organizationId, policyType: "MODERATE" },
          select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true },
        })) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: availability.service.organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true },
        }));

      const booking = await tx.booking.create({
        data: {
          serviceId: availability.serviceId,
          organizationId: availability.service.organizationId,
          userId: user.id,
          availabilityId,
          startsAt: availability.startsAt,
          durationMinutes: availability.durationMinutes,
          price: availability.service.price,
          currency: availability.service.currency,
          status: "PENDING",
        },
        select: { id: true, status: true },
      });

      if (policy) {
        await tx.bookingPolicyRef.create({
          data: {
            bookingId: booking.id,
            policyId: policy.id,
          },
        });
      }

      if (existingCount + 1 >= availability.capacity) {
        await tx.availability.update({
          where: { id: availabilityId },
          data: { status: "FULL" },
        });
      }

      return {
        booking,
        service: {
          id: availability.serviceId,
          price: availability.service.price,
          currency: availability.service.currency,
          organizationId: availability.service.organizationId,
        },
        availability: {
          id: availability.id,
          capacity: availability.capacity,
          status: availability.status,
        },
        policy: policy
          ? {
              id: policy.id,
              name: policy.name,
              policyType: policy.policyType,
              cancellationWindowMinutes: policy.cancellationWindowMinutes,
            }
          : null,
        organization: {
          id: availability.service.organization.id,
          orgType: availability.service.organization.orgType,
          stripeAccountId: availability.service.organization.stripeAccountId,
          stripeChargesEnabled: availability.service.organization.stripeChargesEnabled,
          stripePayoutsEnabled: availability.service.organization.stripePayoutsEnabled,
          feeMode: availability.service.organization.feeMode,
          platformFeeBps: availability.service.organization.platformFeeBps,
          platformFeeFixedCents: availability.service.organization.platformFeeFixedCents,
        },
      };
    });

    if ("error" in result) {
      const mapping = ERROR_MAP[result.error];
      return NextResponse.json(
        { ok: false, error: result.error, message: mapping.message },
        { status: mapping.status },
      );
    }

    const { booking, service, policy, organization, reuseIntentId } = result;
    const currency = (service.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return NextResponse.json(
        { ok: false, error: "CURRENCY_NOT_SUPPORTED", message: ERROR_MAP.CURRENCY_NOT_SUPPORTED.message },
        { status: ERROR_MAP.CURRENCY_NOT_SUPPORTED.status },
      );
    }

    const isPlatformOrg = organization.orgType === "PLATFORM";
    const connectStatus = resolveConnectStatus(
      organization.stripeAccountId ?? null,
      organization.stripeChargesEnabled ?? false,
      organization.stripePayoutsEnabled ?? false,
    );
    if (!isPlatformOrg && connectStatus !== "READY") {
      return NextResponse.json(
        { ok: false, error: "STRIPE_NOT_READY", message: ERROR_MAP.STRIPE_NOT_READY.message },
        { status: ERROR_MAP.STRIPE_NOT_READY.status },
      );
    }

    if (reuseIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(reuseIntentId);
      return NextResponse.json({
        ok: true,
        booking,
        policy,
        amountCents: service.price,
        currency,
        paymentIntentId: existingIntent.id,
        clientSecret: existingIntent.client_secret,
        reused: true,
      });
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();
    const pricing = computePricing(service.price, 0, {
      platformDefaultFeeMode: "INCLUDED",
      organizationPlatformFeeBps: organization.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: organization.platformFeeFixedCents ?? undefined,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });
    const combinedFees = computeCombinedFees({
      amountCents: service.price,
      discountCents: 0,
      feeMode: pricing.feeMode,
      platformFeeBps: pricing.feeBpsApplied,
      platformFeeFixedCents: pricing.feeFixedApplied,
      stripeFeeBps: stripeBaseFees.feeBps,
      stripeFeeFixedCents: stripeBaseFees.feeFixedCents,
    });
    const totalCents = combinedFees.totalCents;
    const platformFeeCents = Math.min(pricing.platformFeeCents, totalCents);

    if (totalCents <= 0) {
      const confirmed = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED" },
        select: { id: true, status: true },
      });

      const { ip, userAgent } = getRequestMeta(req);
      await prisma.$transaction(async (tx) => {
        await tx.userActivity.create({
          data: {
            userId: user.id,
            type: "BOOKING_CREATED",
            visibility: "PRIVATE",
            metadata: {
              bookingId: confirmed.id,
              serviceId: service.id,
              availabilityId,
              organizationId: service.organizationId,
            },
          },
        });
        await recordOrganizationAudit(tx, {
          organizationId: service.organizationId,
          actorUserId: user.id,
          action: "BOOKING_CREATED",
          metadata: {
            bookingId: confirmed.id,
            serviceId: service.id,
            availabilityId,
            policyId: policy?.id ?? null,
          },
          ip,
          userAgent,
        });
      });

      return NextResponse.json({
        ok: true,
        booking: confirmed,
        policy,
        amountCents: totalCents,
        currency,
        paymentIntentId: null,
        clientSecret: null,
        free: true,
      });
    }

    const purchaseId = `booking_${booking.id}`;
    const intentParams = {
      amount: totalCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        serviceBooking: "1",
        bookingId: String(booking.id),
        serviceId: String(service.id),
        availabilityId: String(availabilityId),
        organizationId: String(service.organizationId),
        userId: user.id,
        policyId: policy?.id ? String(policy.id) : "",
        purchaseId,
        platformFeeCents: String(platformFeeCents),
        feeMode: pricing.feeMode,
      },
      description: `Reserva ${service.id}`,
    } as const;

    try {
      const intent =
        !isPlatformOrg && organization.stripeAccountId
          ? await stripe.paymentIntents.create(
              {
                ...intentParams,
                transfer_data: { destination: organization.stripeAccountId },
                application_fee_amount: platformFeeCents,
              },
              { idempotencyKey: purchaseId },
            )
          : await stripe.paymentIntents.create(intentParams, { idempotencyKey: purchaseId });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentIntentId: intent.id },
      });

      return NextResponse.json({
        ok: true,
        booking,
        policy,
        amountCents: totalCents,
        currency,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        reused: false,
      });
    } catch (paymentErr) {
      console.error("[servicos/checkout] erro ao criar PaymentIntent", paymentErr);
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        const activeCount = await tx.booking.count({
          where: { availabilityId, status: { not: "CANCELLED" } },
        });
        if (activeCount < result.availability.capacity && result.availability.status !== "CANCELLED") {
          await tx.availability.update({
            where: { id: availabilityId },
            data: { status: "OPEN" },
          });
        }
      });
      return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_FAILED" }, { status: 500 });
    }
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/checkout error:", err);
    return NextResponse.json({ ok: false, error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
