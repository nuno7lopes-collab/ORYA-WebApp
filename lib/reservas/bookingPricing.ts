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
  isCourtService?: boolean | null;
  durationOverrideMinutes?: number | null;
  courtDurationPriceCents?: number | null;
  bookingPackage?: BookingPackageLike | null;
  addons?: BookingAddonLike[] | null;
};

export function computeBookingPriceComponents(params: ComputeBookingPriceParams) {
  const isCourtService = params.isCourtService === true;
  const durationOverrideMinutes = Number.isFinite(Number(params.durationOverrideMinutes))
    ? Math.round(Number(params.durationOverrideMinutes))
    : null;
  const baseDurationMinutes = Math.max(
    0,
    Math.round(
      isCourtService
        ? durationOverrideMinutes ?? params.serviceDurationMinutes ?? 0
        : params.bookingPackage?.durationMinutes ?? params.serviceDurationMinutes ?? 0,
    ),
  );
  const basePriceCents = Math.max(
    0,
    Math.round(
      isCourtService
        ? params.courtDurationPriceCents ?? params.serviceUnitPriceCents ?? 0
        : params.bookingPackage?.priceCents ?? params.serviceUnitPriceCents ?? 0,
    ),
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
