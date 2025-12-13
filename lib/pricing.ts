import { FeeMode } from "@prisma/client";

export type CheckoutLine = {
  ticketTypeId: number;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

export type FeeContext = {
  eventFeeModeOverride?: FeeMode | null;
  eventFeeMode?: FeeMode | null;
  organizerFeeMode?: FeeMode | null;
  platformDefaultFeeMode?: FeeMode | null;
  eventPlatformFeeBpsOverride?: number | null;
  eventPlatformFeeFixedCentsOverride?: number | null;
  organizerPlatformFeeBps?: number | null;
  organizerPlatformFeeFixedCents?: number | null;
  platformDefaultFeeBps: number;
  platformDefaultFeeFixedCents: number;
  isPlatformOrg?: boolean;
};

export type PricingResult = {
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  totalCents: number;
  feeMode: FeeMode;
  feeBpsApplied: number;
  feeFixedApplied: number;
};

function resolveFeeMode(ctx: FeeContext): FeeMode {
  return (
    ctx.eventFeeModeOverride ||
    ctx.eventFeeMode ||
    ctx.organizerFeeMode ||
    ctx.platformDefaultFeeMode ||
    FeeMode.ADDED
  );
}

function resolvePlatformFees(ctx: FeeContext) {
  if (ctx.isPlatformOrg) {
    return { feeBps: 0, feeFixedCents: 0 };
  }
  const feeBps =
    ctx.eventPlatformFeeBpsOverride ??
    ctx.organizerPlatformFeeBps ??
    ctx.platformDefaultFeeBps;
  const feeFixedCents =
    ctx.eventPlatformFeeFixedCentsOverride ??
    ctx.organizerPlatformFeeFixedCents ??
    ctx.platformDefaultFeeFixedCents;

  return {
    feeBps: Math.max(0, Math.round(feeBps ?? 0)),
    feeFixedCents: Math.max(0, Math.round(feeFixedCents ?? 0)),
  };
}

/**
 * Função central de cálculo de checkout/fees.
 * - Prioridade: override do evento -> configs do organizer -> defaults da plataforma.
 * - feeMode: ADDED (ON_TOP) ou INCLUDED.
 */
export function computePricing(
  subtotalCents: number,
  discountCents: number,
  ctx: FeeContext,
): PricingResult {
  const feeMode = resolveFeeMode(ctx);
  const { feeBps, feeFixedCents } = resolvePlatformFees(ctx);

  const netSubtotal = Math.max(0, subtotalCents - Math.max(0, discountCents));
  const platformFeeCents =
    netSubtotal === 0
      ? 0
      : Math.max(
          0,
          Math.round((netSubtotal * feeBps) / 10_000) + feeFixedCents,
        );

  const totalCents =
    feeMode === FeeMode.ADDED ? netSubtotal + platformFeeCents : netSubtotal;

  return {
    subtotalCents,
    discountCents: Math.max(0, discountCents),
    platformFeeCents,
    totalCents,
    feeMode,
    feeBpsApplied: feeBps,
    feeFixedApplied: feeFixedCents,
  };
}
