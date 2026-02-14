import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addStoreBundle,
  addStoreCartItem,
  createStoreCheckout,
  createStoreDigitalDownload,
  fetchStoreBundles,
  fetchStoreCart,
  fetchStoreCatalog,
  fetchStoreCheckoutPrefill,
  fetchStoreDigitalGrants,
  fetchStoreProduct,
  fetchStorePurchase,
  fetchStorePurchases,
  fetchStorePurchaseReceiptUrl,
  fetchStoreShippingMethods,
  fetchStoreShippingQuote,
  removeStoreBundle,
  removeStoreCartItem,
  updateStoreBundle,
  updateStoreCartItem,
} from "./api";
import type { StoreCart, StoreCartResponse, StoreCheckoutPayload } from "./types";
import { useStoreCartStore } from "./cartStore";

function cartKey(storeId: number) {
  return ["store", "cart", storeId] as const;
}

export function useStoreCatalog(username: string | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "catalog", username ?? "unknown"],
    queryFn: () => fetchStoreCatalog(username ?? ""),
    enabled: enabled && Boolean(username),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreProduct(username: string | null, slug: string | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "product", username ?? "unknown", slug ?? "unknown"],
    queryFn: () => fetchStoreProduct(username ?? "", slug ?? ""),
    enabled: enabled && Boolean(username) && Boolean(slug),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreCart(storeId: number | null, enabled = true) {
  const setCart = useStoreCartStore((state) => state.setCart);
  const cartQuery = useQuery({
    queryKey: storeId ? cartKey(storeId) : ["store", "cart", "unknown"],
    queryFn: () => fetchStoreCart(storeId ?? 0),
    enabled: enabled && typeof storeId === "number" && storeId > 0,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!cartQuery.data?.cart) return;
    setCart(cartQuery.data.cart);
  }, [cartQuery.data?.cart, setCart]);

  return cartQuery;
}

export function useStoreCartMutations(storeId: number | null) {
  const queryClient = useQueryClient();

  const syncCartStore = (payload: StoreCartResponse | undefined) => {
    if (!payload?.cart) return;
    useStoreCartStore.getState().setCart(payload.cart);
  };

  const updateCachedCart = (updater: (cart: StoreCart) => StoreCart) => {
    if (!storeId) return;
    queryClient.setQueryData<StoreCartResponse>(cartKey(storeId), (current) => {
      if (!current?.cart) return current;
      const next: StoreCartResponse = {
        ...current,
        cart: updater(current.cart),
      };
      syncCartStore(next);
      return next;
    });
  };

  const restoreCachedCart = (payload: StoreCartResponse | undefined) => {
    if (!storeId || !payload) return;
    queryClient.setQueryData<StoreCartResponse>(cartKey(storeId), payload);
    syncCartStore(payload);
  };

  const markCartStaleInBackground = () => {
    if (!storeId) return;
    void queryClient.invalidateQueries({ queryKey: cartKey(storeId), refetchType: "inactive" });
  };

  const refresh = async () => {
    if (!storeId) return;
    await queryClient.invalidateQueries({ queryKey: cartKey(storeId) });
  };

  const addItem = useMutation({
    mutationFn: addStoreCartItem,
    onSuccess: refresh,
  });
  const updateItem = useMutation({
    mutationFn: updateStoreCartItem,
    onMutate: async (input) => {
      if (!storeId) return { previous: undefined as StoreCartResponse | undefined };
      await queryClient.cancelQueries({ queryKey: cartKey(storeId) });
      const previous = queryClient.getQueryData<StoreCartResponse>(cartKey(storeId));
      if (typeof input.quantity === "number") {
        updateCachedCart((cart) => ({
          ...cart,
          items: cart.items.map((item) =>
            item.id === input.itemId ? { ...item, quantity: Math.max(1, Math.floor(input.quantity)) } : item,
          ),
        }));
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      restoreCachedCart(context?.previous);
    },
    onSettled: () => {
      markCartStaleInBackground();
    },
  });
  const removeItem = useMutation({
    mutationFn: removeStoreCartItem,
    onMutate: async (input) => {
      if (!storeId) return { previous: undefined as StoreCartResponse | undefined };
      await queryClient.cancelQueries({ queryKey: cartKey(storeId) });
      const previous = queryClient.getQueryData<StoreCartResponse>(cartKey(storeId));
      updateCachedCart((cart) => ({
        ...cart,
        items: cart.items.filter((item) => item.id !== input.itemId),
      }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      restoreCachedCart(context?.previous);
    },
    onSettled: () => {
      markCartStaleInBackground();
    },
  });
  const addBundle = useMutation({
    mutationFn: addStoreBundle,
    onSuccess: refresh,
  });
  const updateBundle = useMutation({
    mutationFn: updateStoreBundle,
    onSuccess: refresh,
  });
  const removeBundle = useMutation({
    mutationFn: removeStoreBundle,
    onSuccess: refresh,
  });

  return {
    addItem,
    updateItem,
    removeItem,
    addBundle,
    updateBundle,
    removeBundle,
    busy:
      addItem.isPending ||
      updateItem.isPending ||
      removeItem.isPending ||
      addBundle.isPending ||
      updateBundle.isPending ||
      removeBundle.isPending,
  };
}

export function useStoreCheckoutPrefill(storeId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "checkout", "prefill", storeId ?? "unknown"],
    queryFn: () => fetchStoreCheckoutPrefill(storeId ?? 0),
    enabled: enabled && typeof storeId === "number" && storeId > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreShippingMethods(input: {
  storeId: number | null;
  country: string | null;
  subtotalCents: number;
  enabled?: boolean;
}) {
  const enabled = input.enabled !== false;
  return useQuery({
    queryKey: ["store", "shipping", input.storeId ?? "unknown", input.country ?? "none", input.subtotalCents],
    queryFn: () =>
      fetchStoreShippingMethods({
        storeId: input.storeId ?? 0,
        country: input.country ?? "",
        subtotalCents: input.subtotalCents,
      }),
    enabled:
      enabled &&
      typeof input.storeId === "number" &&
      input.storeId > 0 &&
      Boolean(input.country && input.country.trim().length > 0),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreShippingQuote(input: {
  storeId: number | null;
  country: string | null;
  subtotalCents: number;
  methodId?: number | null;
  enabled?: boolean;
}) {
  const enabled = input.enabled !== false;
  return useQuery({
    queryKey: [
      "store",
      "shipping",
      "quote",
      input.storeId ?? "unknown",
      input.country ?? "none",
      input.subtotalCents,
      input.methodId ?? "default",
    ],
    queryFn: () =>
      fetchStoreShippingQuote({
        storeId: input.storeId ?? 0,
        country: input.country ?? "",
        subtotalCents: input.subtotalCents,
        methodId: input.methodId ?? null,
      }),
    enabled:
      enabled &&
      typeof input.storeId === "number" &&
      input.storeId > 0 &&
      Boolean(input.country && input.country.trim().length > 0),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreBundles(storeId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "bundles", storeId ?? "unknown"],
    queryFn: () => fetchStoreBundles(storeId ?? 0),
    enabled: enabled && typeof storeId === "number" && storeId > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreCheckoutMutation() {
  return useMutation({
    mutationFn: (input: { storeId: number; payload: StoreCheckoutPayload }) => createStoreCheckout(input),
  });
}

export function useStorePurchases(enabled = true) {
  return useQuery({
    queryKey: ["store", "purchases"],
    queryFn: () => fetchStorePurchases(),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useStorePurchase(orderId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "purchase", orderId ?? "unknown"],
    queryFn: () => fetchStorePurchase(orderId ?? 0),
    enabled: enabled && typeof orderId === "number" && orderId > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreReceiptMutation() {
  return useMutation({
    mutationFn: (orderId: number) => fetchStorePurchaseReceiptUrl(orderId),
  });
}

export function useStoreDigitalGrants(storeId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ["store", "digital", "grants", storeId ?? "all"],
    queryFn: () => fetchStoreDigitalGrants(storeId),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useStoreDigitalDownloadMutation() {
  return useMutation({
    mutationFn: createStoreDigitalDownload,
  });
}

export function useStoreTotals(storeId: number | null, enabled = true) {
  const cart = useStoreCartStore((state) => state.cart);
  return useMemo(() => {
    const source =
      enabled && typeof storeId === "number" && storeId > 0 && cart?.storeId === storeId ? cart : null;
    if (!source) {
      return {
        subtotalCents: 0,
        itemCount: 0,
        requiresShipping: false,
      };
    }

    const standaloneSubtotal = source.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const bundlesSubtotal = source.bundles.reduce((sum, bundle) => sum + bundle.totalCents, 0);
    const standaloneCount = source.items.reduce((sum, item) => sum + item.quantity, 0);
    const bundlesCount = source.bundles.reduce((sum, bundle) => sum + bundle.quantity, 0);

    const requiresShippingStandalone = source.items.some((item) => Boolean(item.product.requiresShipping));
    const requiresShippingBundle = source.bundles.some((bundle) =>
      bundle.items.some((item) => Boolean(item.product.requiresShipping)),
    );

    return {
      subtotalCents: standaloneSubtotal + bundlesSubtotal,
      itemCount: standaloneCount + bundlesCount,
      requiresShipping: requiresShippingStandalone || requiresShippingBundle,
    };
  }, [cart, enabled, storeId]);
}
