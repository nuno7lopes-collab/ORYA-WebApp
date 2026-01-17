"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ProductImage = {
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

type Variant = {
  id: number;
  label: string;
  priceCents: number | null;
  stockQty: number | null;
  isActive: boolean;
};

type OptionValue = {
  id: number;
  value: string;
  label: string | null;
  priceDeltaCents: number;
};

type Option = {
  id: number;
  label: string;
  optionType: "TEXT" | "SELECT" | "NUMBER" | "CHECKBOX";
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  priceDeltaCents: number;
  values: OptionValue[];
};

type StorefrontProductClientProps = {
  storeId: number;
  currency: string;
  product: {
    id: number;
    name: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    shortDescription: string | null;
    description: string | null;
    requiresShipping: boolean;
    images: ProductImage[];
  };
  variants: Variant[];
  options: Option[];
  cartHref: string;
};

type SelectionState = Record<
  number,
  {
    valueId?: number | null;
    value?: string | number | boolean | null;
  }
>;

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export default function StorefrontProductClient({
  storeId,
  currency,
  product,
  variants,
  options,
  cartHref,
}: StorefrontProductClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    variants.find((variant) => variant.isActive)?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selections, setSelections] = useState<SelectionState>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );

  const extraCents = useMemo(() => {
    return options.reduce((total, option) => {
      const selection = selections[option.id];
      if (!selection) return total;
      if (option.optionType === "SELECT") {
        if (!selection.valueId) return total;
        const value = option.values.find((entry) => entry.id === selection.valueId);
        return total + (value?.priceDeltaCents ?? 0);
      }
      if (option.optionType === "CHECKBOX") {
        return selection.value === true ? total + option.priceDeltaCents : total;
      }
      if (selection.value !== undefined && selection.value !== null && String(selection.value).trim() !== "") {
        return total + option.priceDeltaCents;
      }
      return total;
    }, 0);
  }, [options, selections]);

  const basePrice = activeVariant?.priceCents ?? product.priceCents;
  const totalPrice = basePrice + extraCents;

  const handleAddToCart = async () => {
    if (saving) return;
    setError(null);
    setSuccess(null);

    for (const option of options) {
      if (!option.required) continue;
      const selection = selections[option.id];
      if (!selection) {
        setError(`Seleciona: ${option.label}`);
        return;
      }
      if (option.optionType === "SELECT" && !selection.valueId) {
        setError(`Seleciona: ${option.label}`);
        return;
      }
      if (option.optionType !== "SELECT") {
        const value = selection.value;
        if (value === undefined || value === null || String(value).trim() === "") {
          setError(`Preenche: ${option.label}`);
          return;
        }
      }
    }

    const payload = {
      productId: product.id,
      variantId: activeVariant?.id ?? null,
      quantity,
      personalization: {
        selections: options.map((option) => {
          const selection = selections[option.id];
          return {
            optionId: option.id,
            valueId: selection?.valueId ?? null,
            value: selection?.value ?? null,
          };
        }),
      },
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/store/cart/items?storeId=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar ao carrinho.");
      }
      setSuccess("Adicionado ao carrinho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
      <div>
        <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
          {product.images.length ? (
            <img
              src={product.images[selectedImage]?.url}
              alt={product.images[selectedImage]?.altText || product.name}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-white/20 text-white/50">
              Sem imagem
            </div>
          )}
        </div>
        {product.images.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {product.images.map((image, index) => (
              <button
                type="button"
                key={image.url}
                onClick={() => setSelectedImage(index)}
                className={`h-16 w-16 overflow-hidden rounded-xl border ${
                  selectedImage === index ? "border-white/60" : "border-white/10"
                }`}
              >
                <img src={image.url} alt={image.altText || product.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">{product.name}</h2>
          {product.shortDescription ? <p className="mt-2 text-sm text-white/70">{product.shortDescription}</p> : null}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-white">{formatMoney(totalPrice, currency)}</span>
            {product.compareAtPriceCents && product.compareAtPriceCents > basePrice ? (
              <span className="text-sm text-white/50 line-through">
                {formatMoney(product.compareAtPriceCents, currency)}
              </span>
            ) : null}
          </div>
        </div>

        {variants.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Variantes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {variants.map((variant) => (
                <button
                  type="button"
                  key={variant.id}
                  disabled={!variant.isActive}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    variant.id === selectedVariantId
                      ? "border-white/70 bg-white text-black"
                      : "border-white/20 bg-white/5 text-white/70 hover:border-white/50"
                  } disabled:opacity-50`}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {options.length > 0 ? (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Personalizacao</p>
            {options.map((option) => (
              <label key={option.id} className="flex flex-col gap-2 text-sm text-white/80">
                <span>
                  {option.label}
                  {option.required ? " *" : ""}
                </span>
                {option.optionType === "SELECT" ? (
                  <select
                    value={selections[option.id]?.valueId ?? ""}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [option.id]: { valueId: Number(e.target.value) || null },
                      }))
                    }
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecionar</option>
                    {option.values.map((value) => (
                      <option key={value.id} value={value.id}>
                        {value.label || value.value}
                      </option>
                    ))}
                  </select>
                ) : option.optionType === "CHECKBOX" ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selections[option.id]?.value)}
                      onChange={(e) =>
                        setSelections((prev) => ({
                          ...prev,
                          [option.id]: { value: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 accent-[#6BFFFF]"
                    />
                    <span className="text-xs text-white/60">+{formatMoney(option.priceDeltaCents, currency)}</span>
                  </div>
                ) : (
                  <input
                    type={option.optionType === "NUMBER" ? "number" : "text"}
                    value={
                      selections[option.id]?.value !== undefined && selections[option.id]?.value !== null
                        ? String(selections[option.id]?.value)
                        : ""
                    }
                    min={option.minValue ?? undefined}
                    max={option.maxValue ?? undefined}
                    maxLength={option.maxLength ?? undefined}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [option.id]: { value: option.optionType === "NUMBER" ? Number(e.target.value) : e.target.value },
                      }))
                    }
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder=""
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex w-24 flex-col gap-1 text-xs text-white/70">
            Quantidade
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={handleAddToCart}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/90 px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "A adicionar..." : "Adicionar ao carrinho"}
          </button>
          <Link
            href={cartHref}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
          >
            Ver carrinho
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        ) : null}

        {product.description ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {product.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
