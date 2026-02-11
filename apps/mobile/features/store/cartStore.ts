import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeAsyncStorage } from "../../lib/storage";
import type { StoreCart } from "./types";

type StoreCartState = {
  cart: StoreCart | null;
  setCart: (cart: StoreCart | null) => void;
  clearCart: () => void;
  itemCount: () => number;
  subtotalCents: () => number;
};

export const useStoreCartStore = create<StoreCartState>()(
  persist(
    (set, get) => ({
      cart: null,
      setCart: (cart) => set({ cart }),
      clearCart: () => set({ cart: null }),
      itemCount: () => {
        const cart = get().cart;
        if (!cart) return 0;
        const standalone = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const bundles = cart.bundles.reduce((sum, bundle) => sum + bundle.quantity, 0);
        return standalone + bundles;
      },
      subtotalCents: () => {
        const cart = get().cart;
        if (!cart) return 0;
        const standalone = cart.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
        const bundles = cart.bundles.reduce((sum, bundle) => sum + bundle.totalCents, 0);
        return standalone + bundles;
      },
    }),
    {
      name: "orya_store_cart",
      storage: createJSONStorage(() => safeAsyncStorage),
      version: 1,
    },
  ),
);
