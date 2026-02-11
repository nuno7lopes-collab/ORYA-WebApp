const isVitest = typeof process !== "undefined" && Boolean(process.env.VITEST);

if (isVitest) {
  describe.skip("CheckoutScreen", () => {
    it("skipped in vitest", () => {
      expect(true).toBe(true);
    });
  });
} else {
  const React = require("react");
  const { render } = require("@testing-library/react-native");
  const CheckoutScreen = require("../app/checkout/index").default;

  const mockDraft = {
    slug: "event-slug",
    eventId: 1,
    eventTitle: "Evento Teste",
    ticketTypeId: 10,
    ticketName: "Bilhete",
    quantity: 1,
    unitPriceCents: 1200,
    totalCents: 1200,
    currency: "EUR",
    paymentMethod: "card",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };

  const mockState = {
    draft: mockDraft,
    setPaymentMethod: jest.fn(),
    setDraft: jest.fn(),
    setIntent: jest.fn(),
    resetIntent: jest.fn(),
    clearDraft: jest.fn(),
    isExpired: () => false,
  };

  jest.mock("expo-router", () => ({
    Stack: { Screen: () => null },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  }));

  jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({}),
    useIsFocused: () => true,
  }));

jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({ initPaymentSheet: jest.fn(), presentPaymentSheet: jest.fn() }),
  isPlatformPaySupported: jest.fn().mockResolvedValue(false),
}));

jest.mock("@orya/shared", () => ({
  createApiClient: () => ({ request: jest.fn() }),
  tokens: {
    layout: { touchTarget: 44 },
    spacing: { lg: 16 },
    radius: { xl: 24 },
    colors: {
      text: "#fff",
      textSubtle: "rgba(255,255,255,0.6)",
      border: "rgba(255,255,255,0.1)",
      surface: "rgba(255,255,255,0.05)",
      background: "#0b1014",
    },
    motion: { normal: 200 },
  },
}));

jest.mock("../features/checkout/store", () => ({
  useCheckoutStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  buildCheckoutIdempotencyKey: () => "test_key",
}));

jest.mock("../features/checkout/api", () => ({
  createCheckoutIntent: jest.fn(),
  createPairingCheckoutIntent: jest.fn(),
  fetchCheckoutStatus: jest.fn(),
}));

jest.mock("../lib/auth", () => ({
  useAuth: () => ({ session: null }),
}));

  jest.mock("../lib/env", () => ({
    getMobileEnv: () => ({
      appEnv: "test",
      apiBaseUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "sb_test_key",
      stripePublishableKey: "pk_test",
      appleMerchantId: null,
    }),
  }));

  jest.mock("../lib/analytics", () => ({
    trackEvent: jest.fn(),
  }));

  describe("CheckoutScreen", () => {
    it("shows login gate when user is not authenticated", () => {
      const { getByText } = render(<CheckoutScreen />);
      expect(getByText("Inicia sessão para concluir a compra.")).toBeTruthy();
    });
  });
}
