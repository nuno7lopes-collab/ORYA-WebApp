import { useCheckoutStore } from "../features/checkout/store";

describe("checkout store", () => {
  beforeEach(() => {
    useCheckoutStore.setState({ draft: null });
  });

  it("marks draft as expired when past expiry", () => {
    useCheckoutStore.setState({
      draft: {
        slug: "event-slug",
        ticketTypeId: 1,
        quantity: 1,
        unitPriceCents: 1000,
        totalCents: 1000,
        currency: "EUR",
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      },
    });
    expect(useCheckoutStore.getState().isExpired()).toBe(true);
  });

  it("resets intent on payment method change", () => {
    useCheckoutStore.setState({
      draft: {
        slug: "event-slug",
        ticketTypeId: 1,
        quantity: 1,
        unitPriceCents: 1000,
        totalCents: 1000,
        currency: "EUR",
        paymentMethod: "card",
        clientSecret: "secret",
        paymentIntentId: "pi_123",
        purchaseId: "pay_1",
        breakdown: { lines: [], subtotalCents: 1000, discountCents: 0, totalCents: 1000, currency: "EUR" },
        freeCheckout: true,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    });
    useCheckoutStore.getState().setPaymentMethod("mbway");
    const next = useCheckoutStore.getState().draft;
    expect(next?.paymentMethod).toBe("mbway");
    expect(next?.clientSecret).toBeNull();
    expect(next?.paymentIntentId).toBeNull();
    expect(next?.purchaseId).toBeNull();
    expect(next?.breakdown).toBeNull();
    expect(next?.freeCheckout).toBe(false);
  });
});
