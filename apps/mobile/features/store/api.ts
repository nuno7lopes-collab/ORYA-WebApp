import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import type {
  StoreBundlesResponse,
  StoreCatalogResponse,
  StoreProductResponse,
  StoreCartResponse,
  StoreShippingMethodsResponse,
  StoreShippingQuoteResponse,
  StoreCheckoutPayload,
  StoreCheckoutPrefill,
  StoreCheckoutResponse,
  StorePurchasesResponse,
  StorePurchaseDetail,
  StoreDigitalGrant,
} from "./types";

function toPositiveInt(value: number | null | undefined, field: string) {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) <= 0) {
    throw new ApiError(400, `${field} inválido.`);
  }
  return Number(value);
}

export async function fetchStoreCatalog(username: string): Promise<StoreCatalogResponse> {
  if (!username?.trim()) {
    throw new ApiError(400, "Username inválido.");
  }
  const params = new URLSearchParams({ username: username.trim() });
  const response = await api.request<unknown>(`/api/public/store/catalog?${params.toString()}`);
  const payload = unwrapApiResponse<StoreCatalogResponse>(response);
  if (!payload?.store?.id) return payload;

  // Bundles endpoint is the canonical merchandising feed and may contain fresher visibility filtering.
  try {
    const bundles = await fetchStoreBundles(payload.store.id);
    return { ...payload, bundles: bundles.items ?? payload.bundles };
  } catch {
    return payload;
  }
}

export async function fetchStoreProduct(username: string, slug: string): Promise<StoreProductResponse> {
  if (!username?.trim() || !slug?.trim()) {
    throw new ApiError(400, "Produto inválido.");
  }
  const params = new URLSearchParams({ username: username.trim(), slug: slug.trim() });
  const response = await api.request<unknown>(`/api/public/store/product?${params.toString()}`);
  return unwrapApiResponse<StoreProductResponse>(response);
}

export async function fetchStoreCart(storeId: number): Promise<StoreCartResponse> {
  const safeStoreId = toPositiveInt(storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/cart?storeId=${safeStoreId}`);
  return unwrapApiResponse<StoreCartResponse>(response);
}

export async function addStoreCartItem(input: {
  storeId: number;
  productId: number;
  variantId?: number | null;
  quantity?: number;
  personalization?: unknown;
}) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/cart/items?storeId=${safeStoreId}`, {
    method: "POST",
    body: JSON.stringify({
      productId: toPositiveInt(input.productId, "Produto"),
      variantId: input.variantId ?? undefined,
      quantity: input.quantity ?? 1,
      personalization: input.personalization ?? {},
    }),
  });
  return unwrapApiResponse<{ item: { id: number } }>(response);
}

export async function updateStoreCartItem(input: {
  storeId: number;
  itemId: number;
  quantity?: number;
  personalization?: unknown;
}) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const safeItemId = toPositiveInt(input.itemId, "Item");
  const response = await api.request<unknown>(
    `/api/public/store/cart/items/${safeItemId}?storeId=${safeStoreId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...(typeof input.quantity === "number" ? { quantity: input.quantity } : {}),
        ...(input.personalization !== undefined ? { personalization: input.personalization } : {}),
      }),
    },
  );
  return unwrapApiResponse<{ item: { id: number } }>(response);
}

export async function removeStoreCartItem(input: { storeId: number; itemId: number }) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const safeItemId = toPositiveInt(input.itemId, "Item");
  const response = await api.request<unknown>(
    `/api/public/store/cart/items/${safeItemId}?storeId=${safeStoreId}`,
    { method: "DELETE" },
  );
  return unwrapApiResponse<{ ok: true }>(response);
}

export async function addStoreBundle(input: { storeId: number; bundleId: number; quantity?: number }) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/cart/bundles?storeId=${safeStoreId}`, {
    method: "POST",
    body: JSON.stringify({
      bundleId: toPositiveInt(input.bundleId, "Bundle"),
      quantity: input.quantity ?? 1,
    }),
  });
  return unwrapApiResponse<{ bundleKey: string }>(response);
}

export async function updateStoreBundle(input: { storeId: number; bundleKey: string; quantity: number }) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  if (!input.bundleKey?.trim()) throw new ApiError(400, "Bundle inválido.");
  const response = await api.request<unknown>(
    `/api/public/store/cart/bundles/${encodeURIComponent(input.bundleKey)}?storeId=${safeStoreId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity: toPositiveInt(input.quantity, "Quantidade") }),
    },
  );
  return unwrapApiResponse<{ ok: true }>(response);
}

export async function removeStoreBundle(input: { storeId: number; bundleKey: string }) {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  if (!input.bundleKey?.trim()) throw new ApiError(400, "Bundle inválido.");
  const response = await api.request<unknown>(
    `/api/public/store/cart/bundles/${encodeURIComponent(input.bundleKey)}?storeId=${safeStoreId}`,
    { method: "DELETE" },
  );
  return unwrapApiResponse<{ ok: true }>(response);
}

export async function fetchStoreShippingMethods(input: {
  storeId: number;
  country: string;
  subtotalCents: number;
}): Promise<StoreShippingMethodsResponse> {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const country = input.country?.trim().toUpperCase();
  if (!country) throw new ApiError(400, "País inválido.");
  const params = new URLSearchParams({
    storeId: String(safeStoreId),
    country,
    subtotalCents: String(Math.max(0, Math.floor(input.subtotalCents))),
  });
  const response = await api.request<unknown>(`/api/public/store/shipping/methods?${params.toString()}`);
  return unwrapApiResponse<StoreShippingMethodsResponse>(response);
}

export async function fetchStoreShippingQuote(input: {
  storeId: number;
  country: string;
  subtotalCents: number;
  methodId?: number | null;
}): Promise<StoreShippingQuoteResponse> {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const country = input.country?.trim().toUpperCase();
  if (!country) throw new ApiError(400, "País inválido.");
  const params = new URLSearchParams({
    storeId: String(safeStoreId),
    country,
    subtotalCents: String(Math.max(0, Math.floor(input.subtotalCents))),
  });
  if (typeof input.methodId === "number" && Number.isFinite(input.methodId) && input.methodId > 0) {
    params.set("methodId", String(Math.floor(input.methodId)));
  }
  const response = await api.request<unknown>(`/api/public/store/shipping/quote?${params.toString()}`);
  return unwrapApiResponse<StoreShippingQuoteResponse>(response);
}

export async function fetchStoreBundles(storeId: number): Promise<StoreBundlesResponse> {
  const safeStoreId = toPositiveInt(storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/bundles?storeId=${safeStoreId}`);
  return unwrapApiResponse<StoreBundlesResponse>(response);
}

export async function fetchStoreCheckoutPrefill(storeId: number): Promise<StoreCheckoutPrefill> {
  const safeStoreId = toPositiveInt(storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/checkout/prefill?storeId=${safeStoreId}`);
  return unwrapApiResponse<StoreCheckoutPrefill>(response);
}

export async function createStoreCheckout(input: {
  storeId: number;
  payload: StoreCheckoutPayload;
}): Promise<StoreCheckoutResponse> {
  const safeStoreId = toPositiveInt(input.storeId, "Store");
  const response = await api.request<unknown>(`/api/public/store/checkout?storeId=${safeStoreId}`, {
    method: "POST",
    body: JSON.stringify(input.payload),
  });
  return unwrapApiResponse<StoreCheckoutResponse>(response);
}

export async function fetchStorePurchases(input: {
  cursor?: string | null;
  limit?: number;
  status?: string | null;
} = {}): Promise<StorePurchasesResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.max(1, Math.min(60, input.limit ?? 20))));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.status) params.set("status", input.status);
  const response = await api.request<unknown>(`/api/me/purchases/store?${params.toString()}`);
  return unwrapApiResponse<StorePurchasesResponse>(response);
}

export async function fetchStorePurchase(orderId: number): Promise<StorePurchaseDetail> {
  const safeOrderId = toPositiveInt(orderId, "Encomenda");
  const response = await api.request<unknown>(`/api/me/purchases/store/${safeOrderId}`);
  const payload = unwrapApiResponse<{ order: StorePurchaseDetail }>(response);
  return payload.order;
}

export async function fetchStorePurchaseReceiptUrl(orderId: number): Promise<string> {
  const safeOrderId = toPositiveInt(orderId, "Encomenda");
  const response = await api.request<unknown>(`/api/me/purchases/store/${safeOrderId}/receipt`);
  const payload = unwrapApiResponse<{ url: string }>(response);
  if (!payload?.url) throw new ApiError(404, "Recibo indisponível.");
  return payload.url;
}

export async function fetchStoreDigitalGrants(storeId?: number | null): Promise<StoreDigitalGrant[]> {
  const params = new URLSearchParams();
  if (typeof storeId === "number" && Number.isFinite(storeId) && storeId > 0) {
    params.set("storeId", String(storeId));
  }
  const suffix = params.toString();
  const response = await api.request<unknown>(`/api/public/store/digital/grants${suffix ? `?${suffix}` : ""}`);
  const payload = unwrapApiResponse<{ grants: StoreDigitalGrant[] }>(response);
  return payload?.grants ?? [];
}

export async function createStoreDigitalDownload(input: { grantId: number; assetId: number }) {
  const response = await api.request<unknown>(`/api/public/store/digital/download`, {
    method: "POST",
    body: JSON.stringify({
      grantId: toPositiveInt(input.grantId, "Grant"),
      assetId: toPositiveInt(input.assetId, "Ficheiro"),
    }),
  });
  return unwrapApiResponse<{ url: string; filename: string; mimeType: string; sizeBytes: number }>(response);
}
