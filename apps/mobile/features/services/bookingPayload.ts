export type SelectedAddonPayload = { addonId: number; quantity: number };

export type BookingPayloadInput = {
  startsAt: string;
  professionalId?: number | null;
  partySize?: number | null;
  addressId?: string | null;
  selectedAddons?: SelectedAddonPayload[];
  packageId?: number | null;
};

export const buildAddonPayload = (
  quantities: Record<number, number>,
): SelectedAddonPayload[] =>
  Object.entries(quantities)
    .map(([addonId, quantity]) => ({
      addonId: Number(addonId),
      quantity: Number(quantity),
    }))
    .filter((item) => Number.isFinite(item.addonId) && Number.isFinite(item.quantity) && item.quantity > 0);

export const buildBookingPayload = (input: BookingPayloadInput) => ({
  startsAt: input.startsAt,
  professionalId: input.professionalId ?? null,
  partySize: input.partySize ?? null,
  addressId: input.addressId ?? null,
  selectedAddons: input.selectedAddons ?? [],
  packageId: input.packageId ?? null,
});
