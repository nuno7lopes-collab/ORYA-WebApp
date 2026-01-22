import { StoreBundlePricingMode } from "@prisma/client";

type BundlePricingInput = {
  pricingMode: StoreBundlePricingMode;
  priceCents: number | null | undefined;
  percentOff: number | null | undefined;
  baseCents: number;
  bundleQuantity?: number;
};

export function computeBundleTotals({
  pricingMode,
  priceCents,
  percentOff,
  baseCents,
  bundleQuantity = 1,
}: BundlePricingInput) {
  let totalCents = baseCents;

  if (pricingMode === StoreBundlePricingMode.FIXED) {
    totalCents = Math.max(0, (priceCents ?? 0) * Math.max(1, bundleQuantity));
  } else {
    const percent = Math.min(100, Math.max(0, percentOff ?? 0));
    totalCents = Math.max(0, Math.round((baseCents * (100 - percent)) / 100));
  }

  const discountCents = Math.max(0, baseCents - totalCents);

  return { totalCents, discountCents };
}
