import { FeeMode } from "@prisma/client";

export type CheckoutLine = {
  ticketTypeId: number;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

export type FeeContext = {
  eventFeeMode?: FeeMode | null;
  organizationFeeMode?: FeeMode | null;
  platformDefaultFeeMode?: FeeMode | null;
  organizationPlatformFeeBps?: number | null;
  organizationPlatformFeeFixedCents?: number | null;
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
    ctx.eventFeeMode ||
    ctx.organizationFeeMode ||
    ctx.platformDefaultFeeMode ||
    FeeMode.ADDED
  );
}

function resolvePlatformFees(ctx: FeeContext) {
  if (ctx.isPlatformOrg) {
    return { feeBps: 0, feeFixedCents: 0 };
  }
  const feeBps =
    ctx.organizationPlatformFeeBps ??
    ctx.platformDefaultFeeBps;
  const feeFixedCents =
    ctx.organizationPlatformFeeFixedCents ??
    ctx.platformDefaultFeeFixedCents;

  return {
    feeBps: Math.max(0, Math.round(feeBps ?? 0)),
    feeFixedCents: Math.max(0, Math.round(feeFixedCents ?? 0)),
  };
}

/**
 * Função central de cálculo de checkout/fees.
 * - Prioridade: override do evento -> configs do organization -> defaults da plataforma.
 * - feeMode: ADDED ou INCLUDED.
 */
export function computePricing(
  subtotalCents: number,
  discountCents: number,
  ctx: FeeContext,
): PricingResult {
  const resolvedFeeMode = resolveFeeMode(ctx);
  const feeMode = resolvedFeeMode === FeeMode.ON_TOP ? FeeMode.ADDED : resolvedFeeMode;
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
