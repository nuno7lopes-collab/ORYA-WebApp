"use client";

import { useState } from "react";

type BundleItem = {
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    slug: string;
    images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
  };
  variant: { id: number; label: string | null } | null;
};

type BundleCardData = {
  id: number;
  name: string;
  description: string | null;
  pricingMode: string;
  priceCents: number | null;
  percentOff: number | null;
  baseCents: number;
  totalCents: number;
  discountCents: number;
  currency: string;
  items: BundleItem[];
};

type StorefrontBundleCardProps = {
  storeId: number;
  bundle: BundleCardData;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export default function StorefrontBundleCard({ storeId, bundle }: StorefrontBundleCardProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart/bundles?storeId=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: bundle.id, quantity: 1 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar bundle.");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("orya:cart-updated", { detail: { storeId } }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const preview = bundle.items[0]?.product.images?.[0] ?? null;

  return (
    <div className="rounded-3xl border border-white/12 bg-black/35 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap gap-4">
        <div className="h-36 w-36 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {preview ? (
            <img src={preview.url} alt={preview.altText || bundle.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/40">Bundle</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Bundle</p>
          <h3 className="text-lg font-semibold text-white">{bundle.name}</h3>
          {bundle.description ? <p className="text-sm text-white/60">{bundle.description}</p> : null}
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
            <span className="text-white font-semibold">{formatMoney(bundle.totalCents, bundle.currency)}</span>
            {bundle.discountCents > 0 ? (
              <>
                <span className="text-xs text-white/40 line-through">
                  {formatMoney(bundle.baseCents, bundle.currency)}
                </span>
                <span className="text-xs text-emerald-200">
                  Poupa {formatMoney(bundle.discountCents, bundle.currency)}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/90 px-5 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {saving ? "A adicionar..." : "Adicionar bundle"}
          </button>
          {error ? <span className="text-xs text-rose-200">{error}</span> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-[12px] text-white/60 sm:grid-cols-2">
        {bundle.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70">
              {item.quantity}
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
}
