import { buildAddonPayload, buildBookingPayload } from "../bookingPayload";

describe("services/bookingPayload", () => {
  it("inclui durationMinutes no payload de reserva", () => {
    const payload = buildBookingPayload({
      startsAt: "2026-03-03T10:00:00.000Z",
      durationMinutes: 90,
      professionalId: 7,
      partySize: 4,
      addressId: "addr_1",
      selectedAddons: [{ addonId: 10, quantity: 2 }],
      packageId: 22,
    });

    expect(payload).toEqual({
      startsAt: "2026-03-03T10:00:00.000Z",
      durationMinutes: 90,
      professionalId: 7,
      partySize: 4,
      addressId: "addr_1",
      selectedAddons: [{ addonId: 10, quantity: 2 }],
      packageId: 22,
    });
  });

  it("normaliza defaults para null e extras vazios", () => {
    const payload = buildBookingPayload({
      startsAt: "2026-03-03T10:00:00.000Z",
    });

    expect(payload).toEqual({
      startsAt: "2026-03-03T10:00:00.000Z",
      durationMinutes: null,
      professionalId: null,
      partySize: null,
      addressId: null,
      selectedAddons: [],
      packageId: null,
    });
  });

  it("constrói payload de addons apenas com quantidades > 0", () => {
    const payload = buildAddonPayload({ 1: 1, 2: 0, 3: 2 });
    expect(payload).toEqual([
      { addonId: 1, quantity: 1 },
      { addonId: 3, quantity: 2 },
    ]);
  });
});
