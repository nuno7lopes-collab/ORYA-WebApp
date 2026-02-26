import { FeeMode } from "@prisma/client";
import { computePricing } from "@/lib/pricing";

export const ORYA_CARD_PLATFORM_FEE_BPS = 100;

type FeeModeInput = FeeMode;

type ComputeCombinedFeesParams = {
  amountCents: number;
  discountCents: number;
  feeMode: FeeModeInput;
  platformFeeBps: number;
  platformFeeFixedCents: number;
  stripeFeeBps: number;
  stripeFeeFixedCents: number;
};

export type CombinedFeesResult = {
  subtotalCents: number;
  feeMode: FeeMode;
  oryaFeeCents: number;
  combinedFeeCents: number;
  totalCents: number;
};

export function computeCardPlatformFeeCents(
  amountCents: number,
  feeBps = ORYA_CARD_PLATFORM_FEE_BPS,
) {
  const normalizedAmount = Math.max(0, Math.round(amountCents));
  const normalizedFeeBps = Math.max(0, Math.round(feeBps));
  if (normalizedAmount <= 0 || normalizedFeeBps <= 0) return 0;
  return Math.max(0, Math.round((normalizedAmount * normalizedFeeBps) / 10_000));
}

/**
 * Calcula apenas a taxa ORYA (sem estimativas de fees do processador).
 * - feeMode = ADDED → total inclui a taxa ORYA.
 * - feeMode = INCLUDED → taxa ORYA é deduzida do preço base.
 *
 * Nota: estimativas de fees do processador são proibidas (SSOT).
 */
export function computeCombinedFees(params: ComputeCombinedFeesParams): CombinedFeesResult {
  const {
    amountCents,
    discountCents,
    feeMode: rawFeeMode,
    platformFeeBps,
    platformFeeFixedCents,
  } = params;

  const pricing = computePricing(Math.round(amountCents), Math.round(discountCents), {
    eventFeeMode: rawFeeMode,
    platformDefaultFeeMode: rawFeeMode,
    organizationPlatformFeeBps: platformFeeBps,
    organizationPlatformFeeFixedCents: platformFeeFixedCents,
    platformDefaultFeeBps: platformFeeBps,
    platformDefaultFeeFixedCents: platformFeeFixedCents,
  });
  const subtotalCents = Math.max(0, pricing.subtotalCents - pricing.discountCents);
  const oryaFeeCents = pricing.platformFeeCents;
  const combinedFeeCents = Math.max(0, oryaFeeCents);
  const totalCents = pricing.totalCents;

  return {
    subtotalCents,
    feeMode: pricing.feeMode,
    oryaFeeCents,
    combinedFeeCents,
    totalCents,
  };
}
