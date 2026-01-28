"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type CartItem = {
  id: number;
  productId: number;
  variantId: number | null;
  bundleId?: number | null;
  bundleKey?: string | null;
  quantity: number;
  unitPriceCents: number;
  personalization: unknown;
  product: {
    id: number;
    name: string;
    slug: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    currency: string;
    requiresShipping: boolean;
    images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
  };
  variant: { id: number; label: string | null; priceCents: number | null } | null;
};

type BundleItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  perBundleQty: number;
  unitPriceCents: number;
  product: CartItem["product"];
  variant: CartItem["variant"];
};

type BundleGroup = {
  bundleKey: string;
  bundleId: number | null;
  name: string;
  description: string | null;
  pricingMode: string;
  priceCents: number | null;
  percentOff: number | null;
  baseCents: number;
  totalCents: number;
  discountCents: number;
  quantity: number;
  items: BundleItem[];
};

type Recommendation = {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
};

type StorefrontCartOverlayProps = {
  storeId: number;
  currency: string;
  freeShippingThresholdCents?: number | null;
  storeBaseHref: string;
  checkoutHref: string;
  defaultOpen?: boolean;
};

const CART_EVENT = "orya:cart-updated";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export default function StorefrontCartOverlay({
  storeId,
  currency,
  freeShippingThresholdCents,
  storeBaseHref,
  checkoutHref,
  defaultOpen = false,
}: StorefrontCartOverlayProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [bundles, setBundles] = useState<BundleGroup[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  const subtotalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) +
      bundles.reduce((sum, bundle) => sum + bundle.totalCents, 0),
    [items, bundles],
  );

  const itemCount = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.quantity, 0) +
      bundles.reduce((sum, bundle) => sum + bundle.quantity, 0),
    [items, bundles],
  );

  const storageKey = useMemo(() => `orya_store_cart_overlay_${storeId}`, [storeId]);

  const freeShippingRemaining =
    freeShippingThresholdCents !== null && freeShippingThresholdCents !== undefined
      ? Math.max(0, freeShippingThresholdCents - subtotalCents)
      : null;

  const progressPct =
    freeShippingThresholdCents && freeShippingThresholdCents > 0
      ? Math.min(100, (subtotalCents / freeShippingThresholdCents) * 100)
      : 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart?storeId=${storeId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar carrinho.");
      }
      const nextItems = Array.isArray(json.cart?.items) ? json.cart.items : [];
      const nextBundles = Array.isArray(json.cart?.bundles) ? json.cart.bundles : [];
      setItems(nextItems);
      setBundles(nextBundles);
      if (nextItems.length === 0 && nextBundles.length === 0) {
        setCollapsed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (defaultOpen) return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      setCollapsed(stored === "1");
    } catch {
      return;
    }
  }, [storageKey, defaultOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (defaultOpen) return;
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      return;
    }
  }, [collapsed, storageKey, defaultOpen]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ storeId?: number }>).detail;
      if (detail?.storeId && detail.storeId !== storeId) return;
      void load();
      setCollapsed(false);
    };
    window.addEventListener(CART_EVENT, handler);
    return () => window.removeEventListener(CART_EVENT, handler);
  }, [load, storeId]);

  useEffect(() => {
    const excludeIds = [
      ...new Set([
        ...items.map((item) => item.productId),
        ...bundles.flatMap((bundle) => bundle.items.map((item) => item.productId)),
      ]),
    ];
    if (!excludeIds.length) {
      setRecommendations([]);
      return;
    }
    const loadRecommendations = async () => {
      try {
        const params = new URLSearchParams();
        params.set("storeId", String(storeId));
        params.set("limit", "3");
        params.set("exclude", excludeIds.join(","));
        const res = await fetch(`/api/store/recommendations?${params.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) return;
        setRecommendations(Array.isArray(json.items) ? json.items : []);
      } catch {
        return;
      }
    };
    void loadRecommendations();
  }, [items, bundles, storeId]);

  const handleUpdateQuantity = async (item: CartItem, nextQuantity: number) => {
    if (nextQuantity < 1 || savingId !== null) return;
    setSavingId(`item-${item.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/items/${item.id}?storeId=${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar item.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateBundle = async (bundleKey: string, nextQuantity: number) => {
    if (nextQuantity < 1 || savingId !== null) return;
    setSavingId(`bundle-${bundleKey}`);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/bundles/${bundleKey}?storeId=${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar bundle.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (itemId: number) => {
    if (savingId !== null) return;
    setSavingId(`item-${itemId}`);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/items/${itemId}?storeId=${storeId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover item.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveBundle = async (bundleKey: string) => {
    if (savingId !== null) return;
    setSavingId(`bundle-${bundleKey}`);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/bundles/${bundleKey}?storeId=${storeId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover bundle.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleQuickAdd = async (productId: number) => {
    if (savingId !== null) return;
    setSavingId(`quick-${productId}`);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/items?storeId=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar produto.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  if (!loading && items.length === 0 && bundles.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <div
        className={cn(
          "rounded-3xl border border-white/15 bg-[#050a14]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
          collapsed ? "p-2" : "p-4 w-[340px] max-w-[calc(100vw-2rem)]",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-left text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 6h15l-1.5 9h-12L6 6z" />
                <path d="M6 6l-1-3H2" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
            </span>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Carrinho</p>
              <p className="text-sm font-semibold text-white">
                {itemCount} {itemCount === 1 ? "item" : "itens"} · {formatMoney(subtotalCents, currency)}
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Carrinho</p>
                <p className="text-sm font-semibold text-white">
                  {itemCount} {itemCount === 1 ? "item" : "itens"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={storeBaseHref + "/carrinho"}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                >
                  Abrir
                </Link>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Minimizar carrinho"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            ) : null}

            {freeShippingRemaining !== null ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-white/70">
                  <span>
                    {freeShippingRemaining > 0
                      ? `Faltam ${formatMoney(freeShippingRemaining, currency)} para portes gratis.`
                      : "Portes gratis desbloqueados."}
                  </span>
                  <span>{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/70">
                A carregar carrinho...
              </div>
            ) : (
              <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                {bundles.map((bundle) => {
                  const preview = bundle.items[0]?.product.images?.[0];
                  return (
                    <div
                      key={bundle.bundleKey}
                      className="rounded-2xl border border-white/12 bg-black/35 px-3 py-3 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {preview ? (
                            <Image
                              src={preview.url}
                              alt={preview.altText || bundle.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-white">{bundle.name}</p>
                          <p className="text-[11px] text-white/60">
                            {formatMoney(bundle.totalCents, currency)}
                            {bundle.discountCents > 0 ? " · bundle" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateBundle(bundle.bundleKey, Math.max(1, bundle.quantity - 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                            aria-label="Diminuir bundle"
                          >
                            -
                          </button>
                          <span className="text-xs text-white/80">{bundle.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBundle(bundle.bundleKey, bundle.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                            aria-label="Aumentar bundle"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            disabled={savingId !== null}
                            onClick={() => handleRemoveBundle(bundle.bundleKey)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:border-white/30 disabled:opacity-50"
                            aria-label="Remover bundle"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M6 6l12 12M18 6l-12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {bundle.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-[11px] text-white/60">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70">
                              {item.perBundleQty}
                            </span>
                            <span className="flex-1">
                              {item.product.name}
                              {item.variant?.label ? ` · ${item.variant.label}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {items.map((item) => {
                  const image = item.product.images[0];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {image ? (
                          <Image
                            src={image.url}
                            alt={image.altText || item.product.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <Link
                          href={`${storeBaseHref}/produto/${item.product.slug}`}
                          className="text-[12px] font-semibold text-white hover:text-white/90"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-[11px] text-white/60">
                          {formatMoney(item.unitPriceCents, currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item, Number(e.target.value) || 1)}
                          className="w-16 rounded-xl border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={savingId !== null}
                          onClick={() => handleRemove(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:border-white/30 disabled:opacity-50"
                          aria-label="Remover item"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M6 6l12 12M18 6l-12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {items.length > 0 || bundles.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">O teu pedido</p>
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">{formatMoney(subtotalCents, currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={checkoutHref}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/90 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Finalizar compra
                  </Link>
                  <Link
                    href={storeBaseHref}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:border-white/40"
                  >
                    Ver loja
                  </Link>
                </div>
              </div>
            ) : null}

            {recommendations.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Completa o teu pedido</p>
                <div className="space-y-2">
                  {recommendations.map((item) => {
                    const image = item.images[0];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-2 py-2"
                      >
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                          {image ? (
                            <Image
                              src={image.url}
                              alt={image.altText || item.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1">
                          <Link
                            href={`${storeBaseHref}/produto/${item.slug}`}
                            className="text-[12px] font-semibold text-white hover:text-white/90"
                          >
                            {item.name}
                          </Link>
                          <p className="text-[11px] text-white/60">{formatMoney(item.priceCents, item.currency)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(item.id)}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] text-white/80 hover:border-white/40"
                        >
                          Adicionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
