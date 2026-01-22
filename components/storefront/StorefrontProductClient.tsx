"use client";

import { useEffect, useMemo, useState } from "react";
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
    categoryName?: string | null;
    priceCents: number;
    compareAtPriceCents: number | null;
    shortDescription: string | null;
    description: string | null;
    requiresShipping: boolean;
    stockPolicy: string;
    stockQty: number | null;
    images: ProductImage[];
  };
  variants: Variant[];
  options: Option[];
  cartHref: string;
  shippingEta?: { minDays: number | null; maxDays: number | null } | null;
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
  shippingEta = null,
}: StorefrontProductClientProps) {
  const defaultVariant = variants.length === 1 ? variants.find((variant) => variant.isActive) ?? null : null;
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(defaultVariant?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selections, setSelections] = useState<SelectionState>({});
  const requiredOptions = useMemo(() => options.filter((option) => option.required), [options]);
  const optionalOptions = useMemo(() => options.filter((option) => !option.required), [options]);
  const [showPersonalization, setShowPersonalization] = useState(optionalOptions.length === 0);
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
        return total + option.priceDeltaCents + (value?.priceDeltaCents ?? 0);
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
  const compareAt = product.compareAtPriceCents ?? null;
  const hasDiscount = compareAt !== null && compareAt > basePrice;
  const discountPct = hasDiscount ? Math.round(((compareAt - basePrice) / compareAt) * 100) : null;

  const handleTogglePersonalization = () => {
    setShowPersonalization((current) => {
      const next = !current;
      if (current && !next && optionalOptions.length) {
        setSelections((prev) => {
          const nextSelections = { ...prev };
          optionalOptions.forEach((option) => {
            delete nextSelections[option.id];
          });
          return nextSelections;
        });
      }
      return next;
    });
  };

  const stockTracked = product.stockPolicy === "TRACKED";
  const availableStock = useMemo(() => {
    if (!stockTracked) return null;
    if (variants.length > 0) {
      if (!activeVariant) return null;
      return activeVariant.stockQty ?? 0;
    }
    return product.stockQty ?? 0;
  }, [activeVariant, product.stockQty, stockTracked, variants.length]);
  const isOutOfStock = availableStock !== null && availableStock <= 0;
  const canAddToCart = !saving && (!variants.length || Boolean(activeVariant)) && !isOutOfStock;

  useEffect(() => {
    if (availableStock !== null && quantity > availableStock) {
      setQuantity(Math.max(1, availableStock));
    }
  }, [availableStock, quantity]);

  const handleAddToCart = async () => {
    if (saving) return;
    setError(null);
    setSuccess(null);

    if (variants.length > 0 && !activeVariant) {
      setError("Seleciona um tamanho.");
      return;
    }
    if (availableStock !== null && availableStock <= 0) {
      setError("Sem stock disponivel.");
      return;
    }
    if (availableStock !== null && quantity > availableStock) {
      setError("Quantidade superior ao stock.");
      return;
    }

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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("orya:cart-updated", { detail: { storeId } }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,540px),minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40">
          {product.images.length ? (
            <img
              src={product.images[selectedImage]?.url}
              alt={product.images[selectedImage]?.altText || product.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-white/50">Sem imagem</div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          {discountPct ? (
            <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/90">
              -{discountPct}%
            </span>
          ) : null}
        </div>
        {product.images.length > 1 ? (
          <div className="flex flex-wrap gap-3">
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

      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Produto</p>
          {product.categoryName ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-emerald-200/80">
              {product.categoryName}
            </p>
          ) : null}
          <h2 className="mt-2 text-3xl font-semibold text-white">{product.name}</h2>
          {product.shortDescription ? <p className="mt-2 text-sm text-white/70">{product.shortDescription}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-semibold text-white">{formatMoney(totalPrice, currency)}</span>
            {hasDiscount ? (
              <span className="text-sm text-white/50 line-through">{formatMoney(compareAt ?? 0, currency)}</span>
            ) : null}
            {extraCents > 0 ? (
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                +{formatMoney(extraCents, currency)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/35 p-5 space-y-4">
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-white/70"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 7h11v8H3z" />
                <path d="M14 10h3l4 3v2h-7z" />
                <circle cx="7.5" cy="18" r="1.5" />
                <circle cx="17.5" cy="18" r="1.5" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-white">Prazo de envio</p>
              <p className="text-xs text-white/60">
                {product.requiresShipping
                  ? shippingEta?.minDays || shippingEta?.maxDays
                    ? `Envio estimado ${shippingEta.minDays ?? ""}${
                        shippingEta.minDays && shippingEta.maxDays ? "-" : ""
                      }${shippingEta.maxDays ?? ""} dias uteis.`
                    : "Envio estimado apos confirmacao."
                  : "Entrega digital imediata apos pagamento."}
              </p>
            </div>
          </div>

          {variants.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Tamanho</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    disabled={
                      !variant.isActive ||
                      (stockTracked && variant.stockQty !== null && variant.stockQty <= 0)
                    }
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`min-w-[48px] rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      variant.id === selectedVariantId
                        ? "border-white/70 bg-white text-black"
                        : "border-white/20 bg-white/5 text-white/70 hover:border-white/50"
                    } disabled:opacity-50`}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/60">
                {activeVariant
                  ? availableStock !== null
                    ? `Stock: ${availableStock}`
                    : "Stock ilimitado"
                  : "Seleciona um tamanho para ver stock."}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-white/60">
              {availableStock !== null ? `Stock: ${availableStock}` : "Stock ilimitado"}
            </p>
          )}

          {requiredOptions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Obrigatorio</p>
              {requiredOptions.map((option) => (
                <label key={option.id} className="flex flex-col gap-2 text-sm text-white/80">
                  <span className="flex items-center justify-between">
                    <span>{option.label} *</span>
                    {option.priceDeltaCents > 0 ? (
                      <span className="text-xs text-emerald-200">
                        +{formatMoney(option.priceDeltaCents, currency)}
                      </span>
                    ) : null}
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
                      onChange={(e) => {
                        const raw = e.target.value;
                        const value =
                          option.optionType === "NUMBER"
                            ? raw.trim() === "" || Number.isNaN(Number(raw))
                              ? null
                              : Number(raw)
                            : raw;
                        setSelections((prev) => ({
                          ...prev,
                          [option.id]: { value },
                        }));
                      }}
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}

          {optionalOptions.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
              <button
                type="button"
                onClick={handleTogglePersonalization}
                className="flex w-full items-center justify-between text-sm text-white/80"
              >
                <span>Personalizar produto</span>
                <span className="text-xs text-white/50">{showPersonalization ? "Ativo" : "Opcional"}</span>
              </button>
              {showPersonalization ? (
                <div className="space-y-3">
                  {optionalOptions.map((option) => (
                    <label key={option.id} className="flex flex-col gap-2 text-sm text-white/80">
                      <span className="flex items-center justify-between">
                        <span>{option.label}</span>
                        {option.priceDeltaCents > 0 ? (
                          <span className="text-xs text-emerald-200">
                            +{formatMoney(option.priceDeltaCents, currency)}
                          </span>
                        ) : null}
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
                          <span className="text-xs text-white/60">
                            +{formatMoney(option.priceDeltaCents, currency)}
                          </span>
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
                          onChange={(e) => {
                            const raw = e.target.value;
                            const value =
                              option.optionType === "NUMBER"
                                ? raw.trim() === "" || Number.isNaN(Number(raw))
                                  ? null
                                  : Number(raw)
                                : raw;
                            setSelections((prev) => ({
                              ...prev,
                              [option.id]: { value },
                            }));
                          }}
                          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                        />
                      )}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex w-24 flex-col gap-1 text-xs text-white/70">
              Quantidade
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  const next = Math.max(1, Number(e.target.value) || 1);
                  setQuantity(availableStock !== null ? Math.min(next, availableStock) : next);
                }}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              disabled={!canAddToCart}
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
