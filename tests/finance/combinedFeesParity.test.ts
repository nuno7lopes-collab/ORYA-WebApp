import { FeeMode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeCombinedFees } from "@/lib/fees";
import { computePricing } from "@/lib/pricing";

type CaseInput = {
  amountCents: number;
  discountCents: number;
  feeMode: FeeMode;
  platformFeeBps: number;
  platformFeeFixedCents: number;
};

function computeExpected(input: CaseInput) {
  const pricing = computePricing(Math.round(input.amountCents), Math.round(input.discountCents), {
    eventFeeMode: input.feeMode,
    platformDefaultFeeMode: input.feeMode,
    organizationPlatformFeeBps: input.platformFeeBps,
    organizationPlatformFeeFixedCents: input.platformFeeFixedCents,
    platformDefaultFeeBps: input.platformFeeBps,
    platformDefaultFeeFixedCents: input.platformFeeFixedCents,
  });
  return {
    subtotalCents: Math.max(0, pricing.subtotalCents - pricing.discountCents),
    feeMode: pricing.feeMode,
    oryaFeeCents: pricing.platformFeeCents,
    combinedFeeCents: pricing.platformFeeCents,
    totalCents: pricing.totalCents,
  };
}

describe("computeCombinedFees", () => {
  it.each<CaseInput>([
    {
      amountCents: 10_000,
      discountCents: 1_500,
      feeMode: FeeMode.ADDED,
      platformFeeBps: 500,
      platformFeeFixedCents: 30,
    },
    {
      amountCents: 10_000,
      discountCents: 1_500,
      feeMode: FeeMode.INCLUDED,
      platformFeeBps: 500,
      platformFeeFixedCents: 30,
    },
    {
      amountCents: 700,
      discountCents: 900,
      feeMode: FeeMode.ADDED,
      platformFeeBps: 1_000,
      platformFeeFixedCents: 50,
    },
    {
      amountCents: 1000.4,
      discountCents: 0.6,
      feeMode: FeeMode.ADDED,
      platformFeeBps: 123,
      platformFeeFixedCents: 7,
    },
  ])("mantém paridade com computePricing ($feeMode)", (input) => {
    const result = computeCombinedFees({
      ...input,
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
    });
    expect(result).toEqual(computeExpected(input));
  });
});
