import { FeeMode } from "@prisma/client";

type FeeModeInput = FeeMode | "ADDED" | "INCLUDED" | "ON_TOP";

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
 * Calcula taxa ORYA + estimativa Stripe para apresentar como "taxa da plataforma".
 * - Quando feeMode = ADDED/ON_TOP, ajusta o total para que o organizador receba aprox. o subtotal depois de ORYA + Stripe.
 * - Quando feeMode = INCLUDED, as taxas são deduzidas do preço base.
 */
export function computeCombinedFees(params: ComputeCombinedFeesParams): CombinedFeesResult {
  const {
    amountCents,
    discountCents,
    feeMode: rawFeeMode,
    platformFeeBps,
    platformFeeFixedCents,
    stripeFeeBps,
    stripeFeeFixedCents,
  } = params;

  const netSubtotal = Math.max(0, Math.round(amountCents) - Math.max(0, Math.round(discountCents)));
  const feeMode = rawFeeMode === "ON_TOP" ? FeeMode.ADDED : (rawFeeMode as FeeMode);

  const oryaFeeCents =
    netSubtotal === 0
      ? 0
      : Math.max(0, Math.round((netSubtotal * Math.max(0, platformFeeBps)) / 10_000) + Math.max(0, platformFeeFixedCents));

  const stripeRate = Math.max(0, stripeFeeBps) / 10_000;
  const stripeFixed = Math.max(0, stripeFeeFixedCents);

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
    const stripeFeeCentsEstimate = Math.max(0, Math.round(totalCents * stripeRate) + stripeFixed);
    const combinedFeeCents = Math.max(0, oryaFeeCents + stripeFeeCentsEstimate);
    return {
      subtotalCents: netSubtotal,
      feeMode,
      oryaFeeCents,
      stripeFeeCentsEstimate,
      combinedFeeCents,
      totalCents,
    };
  }

  // ADDED/ON_TOP: resolver total para que (total - orya - stripe(total)) ~= subtotal.
  const denom = 1 - stripeRate;
  const totalRaw = denom > 0 ? (netSubtotal + oryaFeeCents + stripeFixed) / denom : netSubtotal + oryaFeeCents + stripeFixed;
  const totalCents = Math.max(0, Math.round(totalRaw));
  const stripeFeeCentsEstimate = Math.max(0, Math.round(totalCents * stripeRate) + stripeFixed);
  const combinedFeeCents = Math.max(0, oryaFeeCents + stripeFeeCentsEstimate);

  return {
    subtotalCents: netSubtotal,
    feeMode,
    oryaFeeCents,
    stripeFeeCentsEstimate,
    combinedFeeCents,
    totalCents,
  };
}
