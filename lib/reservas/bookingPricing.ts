import { applyAddonTotals } from "@/lib/reservas/serviceAddons";

type BookingPackageLike = {
  durationMinutes?: number | null;
  priceCents?: number | null;
};

type BookingAddonLike = {
  deltaMinutes?: number | null;
  deltaPriceCents?: number | null;
  quantity?: number | null;
};

type ComputeBookingPriceParams = {
  serviceDurationMinutes: number | null;
  serviceUnitPriceCents: number | null;
  bookingPackage?: BookingPackageLike | null;
  addons?: BookingAddonLike[] | null;
};

export function computeBookingPriceComponents(params: ComputeBookingPriceParams) {
  const baseDurationMinutes = Math.max(
    0,
    Math.round(
      params.bookingPackage?.durationMinutes ?? params.serviceDurationMinutes ?? 0,
    ),
  );
  const basePriceCents = Math.max(
    0,
    Math.round(params.bookingPackage?.priceCents ?? params.serviceUnitPriceCents ?? 0),
  );

  const addonItems = Array.isArray(params.addons) ? params.addons : [];
  const totalDeltaMinutes = addonItems.reduce(
    (sum, addon) =>
      sum + Math.max(0, Math.round(addon.deltaMinutes ?? 0)) * Math.max(1, Math.round(addon.quantity ?? 1)),
    0,
  );
  const totalDeltaPriceCents = addonItems.reduce(
    (sum, addon) =>
      sum + Math.max(0, Math.round(addon.deltaPriceCents ?? 0)) * Math.max(1, Math.round(addon.quantity ?? 1)),
    0,
  );

  const totals = applyAddonTotals({
    baseDurationMinutes,
    basePriceCents,
    totalDeltaMinutes,
    totalDeltaPriceCents,
  });

  return {
    durationMinutes: totals.durationMinutes,
    priceCents: totals.priceCents,
  };
}
