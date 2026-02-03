import { create } from "zustand";
import { persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckoutBreakdown, CheckoutDraft, CheckoutMethod } from "./types";

const RESUME_WINDOW_MS = 10 * 60 * 1000;

type CheckoutState = {
  draft: CheckoutDraft | null;
  setDraft: (payload: Omit<CheckoutDraft, "createdAt" | "expiresAt">) => void;
  clearDraft: () => void;
  setPaymentMethod: (method: CheckoutMethod) => void;
  setIntent: (params: {
    clientSecret?: string | null;
    paymentIntentId?: string | null;
    purchaseId?: string | null;
    breakdown?: CheckoutBreakdown | null;
    freeCheckout?: boolean;
  }) => void;
  isExpired: () => boolean;
};

const buildDates = () => {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + RESUME_WINDOW_MS);
  return { createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() };
};

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      draft: null,
      setDraft: (payload) => {
        const dates = buildDates();
        set({
          draft: {
            ...payload,
            paymentMethod: payload.paymentMethod ?? "card",
            createdAt: dates.createdAt,
            expiresAt: dates.expiresAt,
          },
        });
      },
      clearDraft: () => set({ draft: null }),
      setPaymentMethod: (method) => {
        const draft = get().draft;
        if (!draft) return;
        set({ draft: { ...draft, paymentMethod: method } });
      },
      setIntent: ({ clientSecret, paymentIntentId, purchaseId, breakdown, freeCheckout }) => {
        const draft = get().draft;
        if (!draft) return;
        const dates = buildDates();
        set({
          draft: {
            ...draft,
            clientSecret: clientSecret ?? draft.clientSecret ?? null,
            paymentIntentId: paymentIntentId ?? draft.paymentIntentId ?? null,
            purchaseId: purchaseId ?? draft.purchaseId ?? null,
            breakdown: breakdown ?? draft.breakdown ?? null,
            freeCheckout: typeof freeCheckout === "boolean" ? freeCheckout : draft.freeCheckout ?? false,
            createdAt: dates.createdAt,
            expiresAt: dates.expiresAt,
          },
        });
      },
      isExpired: () => {
        const draft = get().draft;
        if (!draft?.expiresAt) return true;
        const expiresAt = new Date(draft.expiresAt).getTime();
        if (!Number.isFinite(expiresAt)) return true;
        return Date.now() > expiresAt;
      },
    }),
    {
      name: "orya_checkout",
      storage: {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
      },
      version: 1,
    },
  ),
);
