"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CartItem = {
  id: number;
  productId: number;
  variantId: number | null;
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

type Recommendation = {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
};

type StorefrontCartClientProps = {
  storeId: number;
  currency: string;
  freeShippingThresholdCents: number | null;
  storeBaseHref: string;
  checkoutHref: string;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export default function StorefrontCartClient({
  storeId,
  currency,
  freeShippingThresholdCents,
  storeBaseHref,
  checkoutHref,
}: StorefrontCartClientProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    [items],
  );

  const freeShippingRemaining =
    freeShippingThresholdCents !== null && freeShippingThresholdCents !== undefined
      ? Math.max(0, freeShippingThresholdCents - subtotalCents)
      : null;

  const progressPct =
    freeShippingThresholdCents && freeShippingThresholdCents > 0
      ? Math.min(100, (subtotalCents / freeShippingThresholdCents) * 100)
      : 0;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart?storeId=${storeId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar carrinho.");
      }
      setItems(Array.isArray(json.cart?.items) ? json.cart.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async (exclude: number[]) => {
    try {
      const params = new URLSearchParams();
      params.set("storeId", String(storeId));
      params.set("limit", "3");
      if (exclude.length) params.set("exclude", exclude.join(","));
      const res = await fetch(`/api/store/recommendations?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return;
      setRecommendations(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      return;
    }
  };

  useEffect(() => {
    void load();
  }, [storeId]);

  useEffect(() => {
    void loadRecommendations(items.map((item) => item.productId));
  }, [items]);

  const handleUpdateQuantity = async (item: CartItem, nextQuantity: number) => {
    if (nextQuantity < 1 || savingId !== null) return;
    setSavingId(item.id);
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

  const handleRemove = async (itemId: number) => {
    if (savingId !== null) return;
    setSavingId(itemId);
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar carrinho...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Carrinho vazio.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const image = item.product.images[0];
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div className="h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  {image ? (
                    <img
                      src={image.url}
                      alt={image.altText || item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1">
                  <Link
                    href={`${storeBaseHref}/produto/${item.product.slug}`}
                    className="text-sm font-semibold text-white hover:text-white/90"
                  >
                    {item.product.name}
                  </Link>
                  {item.variant?.label ? (
                    <p className="text-xs text-white/50">Variante: {item.variant.label}</p>
                  ) : null}
                  <p className="text-xs text-white/60">
                    {formatMoney(item.unitPriceCents, currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => handleUpdateQuantity(item, Number(e.target.value) || 1)}
                    className="w-20 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    disabled={savingId !== null}
                    onClick={() => handleRemove(item.id)}
                    className="rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs text-red-100 hover:border-red-300/60 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Subtotal</span>
            <span className="font-semibold text-white">{formatMoney(subtotalCents, currency)}</span>
          </div>
          {freeShippingRemaining !== null ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/60">
                {freeShippingRemaining > 0 ? (
                  <span>Faltam {formatMoney(freeShippingRemaining, currency)} para portes gratis.</span>
                ) : (
                  <span>Portes gratis aplicados.</span>
                )}
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
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={checkoutHref}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/90 px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99]"
            >
              Finalizar compra
            </Link>
            <Link
              href={storeBaseHref}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
            >
              Continuar a comprar
            </Link>
          </div>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Completa o teu pedido</p>
          <div className="grid gap-3 md:grid-cols-3">
            {recommendations.map((item) => {
              const image = item.images[0];
              return (
                <Link
                  key={item.id}
                  href={`${storeBaseHref}/produto/${item.slug}`}
                  className="rounded-2xl border border-white/10 bg-black/30 p-3 transition hover:border-white/35"
                >
                  <div className="h-28 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.altText || item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-white/60">{formatMoney(item.priceCents, item.currency)}</p>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
