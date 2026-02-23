jest.mock("../lib/formatters", () => ({
  formatCurrency: (amount: number, currency: string) => `${currency}:${amount.toFixed(2)}`,
}));

import { resolveEventPriceLabel, resolveEventPriceState } from "../lib/eventPrice";

const createEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: "EVENT" as const,
  slug: "evento-teste",
  title: "Evento teste",
  startsAt: "2026-02-23T10:00:00.000Z",
  endsAt: "2026-02-23T12:00:00.000Z",
  ...overrides,
});

describe("event price contract", () => {
  it("mostra grátis quando o evento é gratuito", () => {
    const t = jest.fn((key: string) => key);
    const event = createEvent({ isGratis: true });

    expect(resolveEventPriceLabel(event as never, t as never)).toBe("common:price.free");
    expect(resolveEventPriceState(event as never, t as never)).toEqual({
      label: "common:price.free",
      isSoon: false,
    });
  });

  it("usa priceFrom quando definido", () => {
    const t = jest.fn((key: string) => key);
    const event = createEvent({ priceFrom: 19.9 });

    const label = resolveEventPriceLabel(event as never, t as never);
    const state = resolveEventPriceState(event as never, t as never);

    expect(label).toBe("common:price.from");
    expect(state).toEqual({ label: "common:price.from", isSoon: false });
    expect(t).toHaveBeenCalledWith(
      "common:price.from",
      expect.objectContaining({ price: expect.any(String) }),
    );
  });

  it("mostra valor fixo quando há apenas um preço de ticket", () => {
    const t = jest.fn((key: string) => key);
    const event = createEvent({
      ticketTypes: [
        {
          id: 10,
          name: "Bilhete",
          price: 2500,
          currency: "EUR",
        },
      ],
    });

    const label = resolveEventPriceLabel(event as never, t as never);
    const state = resolveEventPriceState(event as never, t as never);

    expect(label).toMatch(/25/);
    expect(state).toEqual({ label: expect.any(String), isSoon: false });
    expect(t).not.toHaveBeenCalledWith("common:price.from", expect.anything());
  });

  it("mostra preço desde quando há múltiplos preços de ticket", () => {
    const t = jest.fn((key: string) => key);
    const event = createEvent({
      ticketTypes: [
        {
          id: 11,
          name: "Standard",
          price: 1500,
          currency: "EUR",
        },
        {
          id: 12,
          name: "VIP",
          price: 3000,
          currency: "EUR",
        },
      ],
    });

    const label = resolveEventPriceLabel(event as never, t as never);
    const state = resolveEventPriceState(event as never, t as never);

    expect(label).toBe("common:price.from");
    expect(state).toEqual({ label: "common:price.from", isSoon: false });
    expect(t).toHaveBeenCalledWith(
      "common:price.from",
      expect.objectContaining({ price: expect.any(String) }),
    );
  });
});
