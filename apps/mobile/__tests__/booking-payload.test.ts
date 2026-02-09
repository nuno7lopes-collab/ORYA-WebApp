import { buildAddonPayload, buildBookingPayload } from "../features/services/bookingPayload";

describe("booking payload helpers", () => {
  it("builds addon payload from quantities", () => {
    const payload = buildAddonPayload({ 1: 2, 2: 0, 3: 1 });
    expect(payload).toEqual([
      { addonId: 1, quantity: 2 },
      { addonId: 3, quantity: 1 },
    ]);
  });

  it("builds booking payload with null defaults", () => {
    const payload = buildBookingPayload({
      startsAt: "2026-02-08T10:00:00.000Z",
      selectedAddons: [{ addonId: 5, quantity: 1 }],
    });
    expect(payload).toEqual({
      startsAt: "2026-02-08T10:00:00.000Z",
      professionalId: null,
      partySize: null,
      addressId: null,
      selectedAddons: [{ addonId: 5, quantity: 1 }],
      packageId: null,
    });
  });
});
