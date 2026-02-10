import { FeeMode } from "@prisma/client";

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
  stripeFeeCentsEstimate: number;
  combinedFeeCents: number;
  totalCents: number;
};

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

  const netSubtotal = Math.max(0, Math.round(amountCents) - Math.max(0, Math.round(discountCents)));
  const feeMode = rawFeeMode === FeeMode.ON_TOP ? FeeMode.ADDED : (rawFeeMode as FeeMode);

  const oryaFeeCents =
    netSubtotal === 0
      ? 0
      : Math.max(0, Math.round((netSubtotal * Math.max(0, platformFeeBps)) / 10_000) + Math.max(0, platformFeeFixedCents));

  if (netSubtotal === 0) {
    return {
      subtotalCents: netSubtotal,
      feeMode,
      oryaFeeCents,
      stripeFeeCentsEstimate: 0,
      combinedFeeCents: 0,
      totalCents: 0,
    };
  }

  if (feeMode === FeeMode.INCLUDED) {
    const totalCents = netSubtotal;
    const combinedFeeCents = Math.max(0, oryaFeeCents);
    return {
      subtotalCents: netSubtotal,
      feeMode,
      oryaFeeCents,
      stripeFeeCentsEstimate: 0,
      combinedFeeCents,
      totalCents,
    };
  }

  // ADDED: total = subtotal + taxa ORYA (sem estimativa de fees do processador).
  const totalCents = Math.max(0, Math.round(netSubtotal + oryaFeeCents));
  const combinedFeeCents = Math.max(0, oryaFeeCents);

  return {
    subtotalCents: netSubtotal,
    feeMode,
    oryaFeeCents,
    stripeFeeCentsEstimate: 0,
    combinedFeeCents,
    totalCents,
  };
}
