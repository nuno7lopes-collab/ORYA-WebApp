import React from "react";
import { render } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutScreen from "../app/checkout/index";

const hoisted = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace };
});

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
  setPaymentMethod: vi.fn(),
  setDraft: vi.fn(),
  setIntent: vi.fn(),
  resetIntent: vi.fn(),
  clearDraft: vi.fn(),
  isExpired: () => false,
};

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: hoisted.push, replace: hoisted.replace }),
}));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({}),
  useIsFocused: () => true,
}));

vi.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({ initPaymentSheet: vi.fn(), presentPaymentSheet: vi.fn() }),
  isPlatformPaySupported: vi.fn().mockResolvedValue(false),
}));

vi.mock("@orya/shared", () => ({
  createApiClient: () => ({ request: vi.fn() }),
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

vi.mock("../features/checkout/store", () => ({
  useCheckoutStore: (selector) => selector(mockState),
  buildCheckoutIdempotencyKey: () => "test_key",
}));

vi.mock("../features/checkout/api", () => ({
  createCheckoutIntent: vi.fn(),
  createPairingCheckoutIntent: vi.fn(),
  fetchCheckoutStatus: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ session: null }),
}));

vi.mock("../lib/env", () => ({
  getMobileEnv: () => ({
    appEnv: "test",
    apiBaseUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "sb_test_key",
    stripePublishableKey: "pk_test",
    appleMerchantId: null,
  }),
}));

vi.mock("../lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

describe("CheckoutScreen", () => {
  beforeEach(() => {
    hoisted.push.mockReset();
    hoisted.replace.mockReset();
  });

  it("shows login gate when user is not authenticated", () => {
    const { getByText } = render(<CheckoutScreen />);
    expect(getByText("Inicia sessão para concluir a compra.")).toBeTruthy();
  });
});
