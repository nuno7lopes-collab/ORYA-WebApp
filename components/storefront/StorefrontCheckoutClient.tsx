"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { fetchGeoAutocomplete, fetchGeoDetails } from "@/lib/geo/client";
import type { GeoAutocompleteItem } from "@/lib/geo/provider";

type CartItem = {
  id: number;
  quantity: number;
  unitPriceCents: number;
  product: {
    id: number;
    name: string;
    requiresShipping: boolean;
  };
};

type BundleItem = {
  id: number;
  quantity: number;
  perBundleQty: number;
  unitPriceCents: number;
  product: {
    id: number;
    name: string;
    requiresShipping: boolean;
  };
};

type BundleGroup = {
  bundleKey: string;
  name: string;
  totalCents: number;
  quantity: number;
  items: BundleItem[];
};

type ShippingMethod = {
  id: number;
  zoneId: number;
  name: string;
  description: string | null;
  baseRateCents: number;
  mode: string;
  freeOverCents: number | null;
  isDefault: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  available: boolean;
  shippingCents: number | null;
  freeOverRemainingCents: number | null;
  methodFreeOverRemainingCents: number | null;
};

type CheckoutAddress = {
  addressId: string;
  fullName: string;
  formattedAddress: string | null;
  nif: string | null;
};

type CheckoutPrefillResponse = {
  ok: boolean;
  customer?: { name: string | null; email: string | null; phone: string | null };
  shippingAddress?: CheckoutAddress | null;
  billingAddress?: CheckoutAddress | null;
};

type CheckoutResponse = {
  ok?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  orderId?: number;
  orderNumber?: string | null;
  amountCents?: number;
  currency?: string;
  discountCents?: number;
  shippingCents?: number;
  shippingZoneId?: number | null;
  shippingMethodId?: number | null;
  error?: string;
};

const SHIPPING_COUNTRY = "PT";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function PaymentForm({ onSuccess }: { onSuccess?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Pagamento falhou");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full border border-white/20 bg-white/90 px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] disabled:opacity-60"
      >
        {submitting ? "A processar..." : "Pagar agora"}
      </button>
    </form>
  );
}

export default function StorefrontCheckoutClient({
  storeId,
  currency,
  storeBaseHref,
  cartHref,
  storePolicies,
}: {
  storeId: number;
  currency: string;
  storeBaseHref: string;
  cartHref: string;
  storePolicies?: {
    supportEmail?: string | null;
    supportPhone?: string | null;
    returnPolicy?: string | null;
    privacyPolicy?: string | null;
    termsUrl?: string | null;
  };
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [bundles, setBundles] = useState<BundleGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [shipping, setShipping] = useState({
    fullName: "",
    addressId: null as string | null,
    formattedAddress: "",
    nif: "",
  });
  const [shippingAddressQuery, setShippingAddressQuery] = useState("");
  const [shippingAddressSuggestions, setShippingAddressSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [shippingAddressLoading, setShippingAddressLoading] = useState(false);
  const [shippingAddressError, setShippingAddressError] = useState<string | null>(null);
  const [showShippingSuggestions, setShowShippingSuggestions] = useState(false);
  const shippingSearchSeqRef = useRef(0);
  const shippingDetailsSeqRef = useRef(0);
  const shippingSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shippingBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeShippingProviderRef = useRef<string | null>(null);
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState({
    fullName: "",
    addressId: null as string | null,
    formattedAddress: "",
    nif: "",
  });
  const [billingAddressQuery, setBillingAddressQuery] = useState("");
  const [billingAddressSuggestions, setBillingAddressSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [billingAddressLoading, setBillingAddressLoading] = useState(false);
  const [billingAddressError, setBillingAddressError] = useState<string | null>(null);
  const [showBillingSuggestions, setShowBillingSuggestions] = useState(false);
  const billingSearchSeqRef = useRef(0);
  const billingDetailsSeqRef = useRef(0);
  const billingSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billingBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBillingProviderRef = useRef<string | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);

  const hasPolicies = Boolean(
    storePolicies?.supportEmail ||
      storePolicies?.supportPhone ||
      storePolicies?.returnPolicy ||
      storePolicies?.privacyPolicy ||
      storePolicies?.termsUrl,
  );

  const policyLinks = useMemo(() => {
    const links: Array<{ label: string; href: string; external?: boolean }> = [];
    if (storePolicies?.termsUrl) {
      links.push({ label: "Termos e condicoes", href: storePolicies.termsUrl, external: true });
    }
    if (storePolicies?.returnPolicy) {
      links.push({ label: "Politica de devolucoes", href: `${storeBaseHref}#politica-devolucoes` });
    }
    if (storePolicies?.privacyPolicy) {
      links.push({ label: "Politica de privacidade", href: `${storeBaseHref}#politica-privacidade` });
    }
    return links;
  }, [storePolicies?.termsUrl, storePolicies?.returnPolicy, storePolicies?.privacyPolicy, storeBaseHref]);

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  const requiresShipping = useMemo(
    () =>
      items.some((item) => item.product.requiresShipping) ||
      bundles.some((bundle) => bundle.items.some((item) => item.product.requiresShipping)),
    [items, bundles],
  );

  const subtotalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) +
      bundles.reduce((sum, bundle) => sum + bundle.totalCents, 0),
    [items, bundles],
  );

  const selectedMethod = useMemo(
    () => shippingMethods.find((method) => method.id === selectedShippingMethodId) ?? null,
    [shippingMethods, selectedShippingMethodId],
  );

  const shippingCents = selectedMethod?.shippingCents ?? 0;
  const totalCents = subtotalCents + shippingCents;
  const checkoutCurrency = checkout?.currency ?? currency;
  const checkoutShippingCents = checkout?.shippingCents ?? shippingCents;
  const checkoutDiscountCents = checkout?.discountCents ?? 0;
  const checkoutTotalCents = checkout?.amountCents ?? totalCents;
  const checkoutFeeCents =
    checkout?.amountCents != null
      ? Math.max(0, checkoutTotalCents - (subtotalCents + checkoutShippingCents - checkoutDiscountCents))
      : 0;

  const freeShippingRemaining = useMemo(() => {
    if (!selectedMethod) return null;
    const candidates = [selectedMethod.freeOverRemainingCents, selectedMethod.methodFreeOverRemainingCents].filter(
      (value): value is number => value !== null && value !== undefined,
    );
    if (!candidates.length) return null;
    return Math.max(0, Math.min(...candidates));
  }, [selectedMethod]);

  const progressPct = useMemo(() => {
    if (freeShippingRemaining === null) return 0;
    const target = subtotalCents + freeShippingRemaining;
    return target > 0 ? Math.min(100, (subtotalCents / target) * 100) : 0;
  }, [freeShippingRemaining, subtotalCents]);

  const loadCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/cart?storeId=${storeId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar carrinho.");
      }
      setItems(Array.isArray(json.cart?.items) ? json.cart.items : []);
      setBundles(Array.isArray(json.cart?.bundles) ? json.cart.bundles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const applyPrefill = (current: string, next?: string | null) => {
    if (current.trim()) return current;
    return next?.trim() ? next : "";
  };

  const applyAddressPrefill = (current: typeof shipping, next?: CheckoutAddress | null, fallbackName?: string | null) => {
    if (!next) return current;
    return {
      fullName: applyPrefill(current.fullName, next.fullName || fallbackName || null),
      addressId: current.addressId ?? next.addressId ?? null,
      formattedAddress: applyPrefill(current.formattedAddress, next.formattedAddress),
      nif: applyPrefill(current.nif, next.nif),
    };
  };

  const loadShippingMethods = async (country: string) => {
    if (!country.trim()) return;
    setShippingLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        storeId: String(storeId),
        country,
        subtotalCents: String(subtotalCents),
      });
      const res = await fetch(`/api/store/shipping/methods?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar metodos.");
      }
      const next = Array.isArray(json.methods) ? (json.methods as ShippingMethod[]) : [];
      setShippingMethods(next);
      const defaultMethod = next.find((method) => method.isDefault && method.available) ?? next.find((m) => m.available);
      setSelectedShippingMethodId(defaultMethod?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setShippingMethods([]);
      setSelectedShippingMethodId(null);
    } finally {
      setShippingLoading(false);
    }
  };

  useEffect(() => {
    void loadCart();
  }, [storeId]);

  useEffect(() => {
    if (prefillLoaded) return;
    const loadPrefill = async () => {
      try {
        const res = await fetch(`/api/store/checkout/prefill?storeId=${storeId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as CheckoutPrefillResponse | null;
        if (!res.ok || !json?.ok) {
          setPrefillLoaded(true);
          return;
        }
        const customerData = json.customer ?? { name: null, email: null, phone: null };
        setCustomer((prev) => ({
          name: applyPrefill(prev.name, customerData.name),
          email: applyPrefill(prev.email, customerData.email),
          phone: applyPrefill(prev.phone, customerData.phone),
        }));
        setShipping((prev) => applyAddressPrefill(prev, json.shippingAddress, customerData.name));
        setBilling((prev) => applyAddressPrefill(prev, json.billingAddress, customerData.name));
        if (json.shippingAddress?.formattedAddress) {
          setShippingAddressQuery((prev) => (prev.trim() ? prev : json.shippingAddress?.formattedAddress ?? ""));
        }
        if (json.billingAddress?.formattedAddress) {
          setBillingAddressQuery((prev) => (prev.trim() ? prev : json.billingAddress?.formattedAddress ?? ""));
        }
      } catch {
        return;
      } finally {
        setPrefillLoaded(true);
      }
    };
    void loadPrefill();
  }, [storeId, prefillLoaded]);

  useEffect(() => {
    if (!requiresShipping) {
      if (shippingSearchTimeoutRef.current) {
        clearTimeout(shippingSearchTimeoutRef.current);
      }
      setShippingAddressSuggestions([]);
      setShippingAddressLoading(false);
      setShippingAddressError(null);
      return;
    }
    const query = shippingAddressQuery.trim();
    if (query.length < 2) {
      setShippingAddressSuggestions([]);
      setShippingAddressLoading(false);
      setShippingAddressError(null);
      return;
    }
    if (shippingSearchTimeoutRef.current) {
      clearTimeout(shippingSearchTimeoutRef.current);
    }
    setShippingAddressError(null);
    const seq = ++shippingSearchSeqRef.current;
    shippingSearchTimeoutRef.current = setTimeout(async () => {
      setShippingAddressLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (shippingSearchSeqRef.current === seq) {
          setShippingAddressSuggestions(items);
        }
      } catch (err) {
        if (shippingSearchSeqRef.current === seq) {
          setShippingAddressSuggestions([]);
          setShippingAddressError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (shippingSearchSeqRef.current === seq) {
          setShippingAddressLoading(false);
        }
      }
    }, 280);

    return () => {
      if (shippingSearchTimeoutRef.current) {
        clearTimeout(shippingSearchTimeoutRef.current);
      }
    };
  }, [requiresShipping, shippingAddressQuery]);

  useEffect(() => {
    if (!requiresShipping || billingSame) {
      if (billingSearchTimeoutRef.current) {
        clearTimeout(billingSearchTimeoutRef.current);
      }
      setBillingAddressSuggestions([]);
      setBillingAddressLoading(false);
      setBillingAddressError(null);
      return;
    }
    const query = billingAddressQuery.trim();
    if (query.length < 2) {
      setBillingAddressSuggestions([]);
      setBillingAddressLoading(false);
      setBillingAddressError(null);
      return;
    }
    if (billingSearchTimeoutRef.current) {
      clearTimeout(billingSearchTimeoutRef.current);
    }
    setBillingAddressError(null);
    const seq = ++billingSearchSeqRef.current;
    billingSearchTimeoutRef.current = setTimeout(async () => {
      setBillingAddressLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (billingSearchSeqRef.current === seq) {
          setBillingAddressSuggestions(items);
        }
      } catch (err) {
        if (billingSearchSeqRef.current === seq) {
          setBillingAddressSuggestions([]);
          setBillingAddressError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (billingSearchSeqRef.current === seq) {
          setBillingAddressLoading(false);
        }
      }
    }, 280);

    return () => {
      if (billingSearchTimeoutRef.current) {
        clearTimeout(billingSearchTimeoutRef.current);
      }
    };
  }, [requiresShipping, billingSame, billingAddressQuery]);

  const handleSelectShippingSuggestion = async (item: GeoAutocompleteItem) => {
    setShippingAddressError(null);
    setShipping((prev) => ({ ...prev, addressId: null, formattedAddress: item.label }));
    setShippingAddressQuery(item.label);
    setShippingAddressSuggestions([]);
    setShowShippingSuggestions(false);
    activeShippingProviderRef.current = item.providerId;
    const seq = ++shippingDetailsSeqRef.current;
    setShippingAddressLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (shippingDetailsSeqRef.current !== seq) return;
      if (activeShippingProviderRef.current !== item.providerId) return;
      const addressId = details?.addressId ?? null;
      if (!addressId) {
        setShippingAddressError("Morada inválida.");
        return;
      }
      const formatted = details?.formattedAddress ?? item.label;
      setShipping((prev) => ({ ...prev, addressId, formattedAddress: formatted }));
      setShippingAddressQuery(formatted);
    } catch (err) {
      if (shippingDetailsSeqRef.current === seq) {
        setShippingAddressError(err instanceof Error ? err.message : "Falha ao normalizar morada.");
      }
    } finally {
      if (shippingDetailsSeqRef.current === seq) {
        setShippingAddressLoading(false);
      }
    }
  };

  const handleSelectBillingSuggestion = async (item: GeoAutocompleteItem) => {
    setBillingAddressError(null);
    setBilling((prev) => ({ ...prev, addressId: null, formattedAddress: item.label }));
    setBillingAddressQuery(item.label);
    setBillingAddressSuggestions([]);
    setShowBillingSuggestions(false);
    activeBillingProviderRef.current = item.providerId;
    const seq = ++billingDetailsSeqRef.current;
    setBillingAddressLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (billingDetailsSeqRef.current !== seq) return;
      if (activeBillingProviderRef.current !== item.providerId) return;
      const addressId = details?.addressId ?? null;
      if (!addressId) {
        setBillingAddressError("Morada inválida.");
        return;
      }
      const formatted = details?.formattedAddress ?? item.label;
      setBilling((prev) => ({ ...prev, addressId, formattedAddress: formatted }));
      setBillingAddressQuery(formatted);
    } catch (err) {
      if (billingDetailsSeqRef.current === seq) {
        setBillingAddressError(err instanceof Error ? err.message : "Falha ao normalizar morada.");
      }
    } finally {
      if (billingDetailsSeqRef.current === seq) {
        setBillingAddressLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!requiresShipping) return;
    void loadShippingMethods(SHIPPING_COUNTRY);
  }, [requiresShipping, subtotalCents]);

  const handleStartCheckout = async () => {
    if (!items.length && !bundles.length) {
      setError("Carrinho vazio.");
      return;
    }
    if (!customer.name.trim() || !customer.email.trim()) {
      setError("Preenche nome e email.");
      return;
    }
    if (requiresShipping) {
      if (!shipping.fullName.trim() || !shipping.addressId) {
        setError("Seleciona a morada de envio.");
        return;
      }
      if (!selectedShippingMethodId) {
        setError("Seleciona um metodo de envio.");
        return;
      }
      if (!billingSame) {
        if (!billing.fullName.trim() || !billing.addressId) {
          setError("Seleciona a morada de faturação.");
          return;
        }
      }
    }

    setLoading(true);
    setError(null);
    setPromoError(null);
    try {
      const res = await fetch(`/api/store/checkout?storeId=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone || null,
          },
          shippingAddress: requiresShipping
            ? {
                addressId: shipping.addressId,
                fullName: shipping.fullName,
                nif: shipping.nif || null,
              }
            : null,
          billingAddress:
            !requiresShipping || billingSame
              ? null
              : {
                  addressId: billing.addressId,
                  fullName: billing.fullName,
                  nif: billing.nif || null,
                },
          shippingMethodId: requiresShipping ? selectedShippingMethodId : null,
          notes: notes || null,
          promoCode: promoCode?.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as CheckoutResponse | null;
      if (!res.ok || !json?.ok || !json.clientSecret) {
        if (promoCode && json?.error) {
          setPromoError(json.error);
        }
        throw new Error(json?.error || "Erro ao iniciar checkout.");
      }
      setCheckout(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#FF7A18",
      colorBackground: "#0B0D0F",
      colorText: "#F8FAFC",
      fontFamily: "inherit",
    },
  } as const;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-white/60">A preparar checkout...</p>}

      {!checkout ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Contacto</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={customer.name}
                onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="Nome"
              />
              <input
                value={customer.email}
                onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="Email"
              />
              <input
                value={customer.phone}
                onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="Telefone (opcional)"
              />
            </div>
          </div>

          {requiresShipping ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Morada de envio</p>
              <div className="space-y-3">
                <input
                  value={shipping.fullName}
                  onChange={(e) => setShipping((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Nome completo"
                />
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/50">Morada (Apple Maps)</label>
                  <div className="relative overflow-visible">
                    <input
                      value={shippingAddressQuery}
                      onChange={(e) => {
                        const next = e.target.value;
                        setShippingAddressQuery(next);
                        setShipping((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
                        setShippingAddressError(null);
                        activeShippingProviderRef.current = null;
                        setShowShippingSuggestions(true);
                      }}
                      onFocus={() => setShowShippingSuggestions(true)}
                      onBlur={() => {
                        if (shippingBlurTimeoutRef.current) {
                          clearTimeout(shippingBlurTimeoutRef.current);
                        }
                        shippingBlurTimeoutRef.current = setTimeout(
                          () => setShowShippingSuggestions(false),
                          120,
                        );
                      }}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      placeholder="Procura um local ou morada"
                    />
                    {showShippingSuggestions && (
                      <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                        {shippingAddressLoading ? (
                          <div className="px-3 py-2 text-sm text-white/70 animate-pulse">
                            A procurar…
                          </div>
                        ) : shippingAddressError ? (
                          <div className="px-3 py-2 text-sm text-amber-100">{shippingAddressError}</div>
                        ) : shippingAddressSuggestions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-white/60">Sem sugestões.</div>
                        ) : (
                          shippingAddressSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.providerId}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectShippingSuggestion(suggestion)}
                              className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                            >
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="font-semibold text-white">{suggestion.label}</span>
                                <div className="flex items-center gap-2 text-[12px] text-white/65">
                                  <span>{suggestion.city || "—"}</span>
                                  {suggestion.sourceProvider === "APPLE_MAPS" && (
                                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                                      Apple
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {shipping.addressId && (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                      Morada confirmada: {shipping.formattedAddress || shippingAddressQuery}
                    </div>
                  )}
                  {shippingAddressError && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                      {shippingAddressError}
                    </div>
                  )}
                </div>
                <input
                  value={shipping.nif}
                  onChange={(e) => setShipping((prev) => ({ ...prev, nif: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="NIF (opcional)"
                />
              </div>
            </div>
          ) : null}

          {requiresShipping ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
              <label className="flex items-center gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={billingSame}
                  onChange={(e) => setBillingSame(e.target.checked)}
                  className="h-4 w-4 accent-[#FF7A18]"
                />
                Usar morada de envio para faturacao
              </label>
              {!billingSame ? (
                <div className="space-y-3">
                  <input
                    value={billing.fullName}
                    onChange={(e) => setBilling((prev) => ({ ...prev, fullName: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Nome completo"
                  />
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50">Morada (Apple Maps)</label>
                    <div className="relative overflow-visible">
                      <input
                        value={billingAddressQuery}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBillingAddressQuery(next);
                          setBilling((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
                          setBillingAddressError(null);
                          activeBillingProviderRef.current = null;
                          setShowBillingSuggestions(true);
                        }}
                        onFocus={() => setShowBillingSuggestions(true)}
                        onBlur={() => {
                          if (billingBlurTimeoutRef.current) {
                            clearTimeout(billingBlurTimeoutRef.current);
                          }
                          billingBlurTimeoutRef.current = setTimeout(
                            () => setShowBillingSuggestions(false),
                            120,
                          );
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                        placeholder="Procura um local ou morada"
                      />
                      {showBillingSuggestions && (
                        <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                          {billingAddressLoading ? (
                            <div className="px-3 py-2 text-sm text-white/70 animate-pulse">
                              A procurar…
                            </div>
                          ) : billingAddressError ? (
                            <div className="px-3 py-2 text-sm text-amber-100">{billingAddressError}</div>
                          ) : billingAddressSuggestions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-white/60">Sem sugestões.</div>
                          ) : (
                            billingAddressSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.providerId}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSelectBillingSuggestion(suggestion)}
                                className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                              >
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="font-semibold text-white">{suggestion.label}</span>
                                  <div className="flex items-center gap-2 text-[12px] text-white/65">
                                    <span>{suggestion.city || "—"}</span>
                                    {suggestion.sourceProvider === "APPLE_MAPS" && (
                                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                                        Apple
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {billing.addressId && (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                        Morada confirmada: {billing.formattedAddress || billingAddressQuery}
                      </div>
                    )}
                    {billingAddressError && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                        {billingAddressError}
                      </div>
                    )}
                  </div>
                  <input
                    value={billing.nif}
                    onChange={(e) => setBilling((prev) => ({ ...prev, nif: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="NIF (opcional)"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {requiresShipping ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Metodo de envio</p>
              {shippingLoading ? (
                <p className="text-xs text-white/60">A carregar metodos...</p>
              ) : shippingMethods.length === 0 ? (
                <p className="text-xs text-white/60">
                  Sem metodos para Portugal.
                </p>
              ) : (
                <div className="space-y-2">
                  {shippingMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
                        selectedShippingMethodId === method.id
                          ? "border-white/40 bg-white/10"
                          : "border-white/10 bg-black/30"
                      }`}
                    >
                      <div>
                        <p className="text-white">{method.name}</p>
                        {method.description ? (
                          <p className="text-xs text-white/60">{method.description}</p>
                        ) : null}
                        {method.etaMinDays || method.etaMaxDays ? (
                          <p className="text-xs text-white/50">
                            ETA {method.etaMinDays ?? ""}-{method.etaMaxDays ?? ""} dias
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white">
                          {method.shippingCents !== null ? formatMoney(method.shippingCents, currency) : "-"}
                        </span>
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selectedShippingMethodId === method.id}
                          onChange={() => setSelectedShippingMethodId(method.id)}
                          className="h-4 w-4 accent-[#FF7A18]"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              )}
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
            </div>
          ) : null}

          {!requiresShipping ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Produto digital</p>
              <p className="text-sm text-white/70">Sem necessidade de envio fisico.</p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Resumo</p>
            <div className="space-y-2">
              {bundles.map((bundle) => (
                <div key={bundle.bundleKey} className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    {bundle.name} × {bundle.quantity}
                  </span>
                  <span>{formatMoney(bundle.totalCents, currency)}</span>
                </div>
              ))}
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>{formatMoney(item.unitPriceCents * item.quantity, currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Subtotal</span>
              <span className="text-white">{formatMoney(subtotalCents, currency)}</span>
            </div>
            {promoCode ? (
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Codigo aplicado</span>
                <span className="text-white/70">{promoCode}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Portes</span>
              <span className="text-white">{formatMoney(shippingCents, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-base text-white">
              <span>Total</span>
              <span className="font-semibold">{formatMoney(totalCents, currency)}</span>
            </div>
            {promoError ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {promoError}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  if (promoError) setPromoError(null);
                }}
                className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="Codigo promocional"
              />
              {promoCode ? (
                <button
                  type="button"
                  onClick={() => {
                    setPromoCode(null);
                    setPromoInput("");
                    setPromoError(null);
                  }}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/70 hover:border-white/40"
                >
                  Remover
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const normalized = promoInput.trim().toUpperCase();
                    if (!normalized) {
                      setPromoError("Insere um codigo.");
                      return;
                    }
                    setPromoCode(normalized);
                    setPromoError(null);
                  }}
                  className="rounded-full border border-white/20 bg-white/90 px-4 py-2 text-xs font-semibold text-black shadow-[0_8px_20px_rgba(255,255,255,0.18)]"
                >
                  Aplicar
                </button>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Notas para a loja (opcional)"
            />
            {hasPolicies ? (
              <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-[12px] text-white/70 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Políticas</p>
                {policyLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {policyLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
                {storePolicies?.returnPolicy ? (
                  <div className="max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-white/70">
                    {storePolicies.returnPolicy}
                  </div>
                ) : null}
                {storePolicies?.privacyPolicy ? (
                  <div className="max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-white/70">
                    {storePolicies.privacyPolicy}
                  </div>
                ) : null}
                {(storePolicies?.supportEmail || storePolicies?.supportPhone) && (
                  <p className="text-[11px] text-white/60">
                    Suporte: {storePolicies.supportEmail ?? ""}{storePolicies.supportEmail && storePolicies.supportPhone ? " · " : ""}{storePolicies.supportPhone ?? ""}
                  </p>
                )}
                <p className="text-[11px] text-white/50">
                  As politicas estao disponiveis nos links acima (assumimos que leste e aceitaste).
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleStartCheckout}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/90 px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "A criar pagamento..." : "Continuar para pagamento"}
              </button>
              <Link
                href={cartHref}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
              >
                Voltar ao carrinho
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {checkout && stripePromise && !paymentSuccess ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Resumo final</p>
            <div className="space-y-2">
              {bundles.map((bundle) => (
                <div key={bundle.bundleKey} className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    {bundle.name} × {bundle.quantity}
                  </span>
                  <span>{formatMoney(bundle.totalCents, checkoutCurrency)}</span>
                </div>
              ))}
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>{formatMoney(item.unitPriceCents * item.quantity, checkoutCurrency)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Subtotal</span>
              <span className="text-white">{formatMoney(subtotalCents, checkoutCurrency)}</span>
            </div>
            {checkoutDiscountCents > 0 ? (
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Desconto</span>
                <span className="text-emerald-200">-{formatMoney(checkoutDiscountCents, checkoutCurrency)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Portes</span>
              <span className="text-white">{formatMoney(checkoutShippingCents, checkoutCurrency)}</span>
            </div>
            {checkoutFeeCents > 0 ? (
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Taxa de servico</span>
                <span className="text-white">{formatMoney(checkoutFeeCents, checkoutCurrency)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-base text-white">
              <span>Total a pagar</span>
              <span className="font-semibold">{formatMoney(checkoutTotalCents, checkoutCurrency)}</span>
            </div>
          </div>
          <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret, appearance }}>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Pagamento</p>
              <div className="mt-4">
                <PaymentForm onSuccess={() => setPaymentSuccess(true)} />
              </div>
            </div>
          </Elements>
        </div>
      ) : null}

      {paymentSuccess ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-100">
          <p>
            Pagamento confirmado{checkout?.orderNumber ? ` (${checkout.orderNumber})` : ""}. Vais receber a confirmacao por email.
          </p>
          {(storePolicies?.supportEmail || storePolicies?.supportPhone) && (
            <p className="mt-2 text-xs text-emerald-100/80">
              Suporte: {storePolicies?.supportEmail ?? ""}{storePolicies?.supportEmail && storePolicies?.supportPhone ? " · " : ""}{storePolicies?.supportPhone ?? ""}
            </p>
          )}
          <p className="mt-2 text-xs text-emerald-100/80">
            Podes acompanhar a encomenda e descarregar produtos digitais em{" "}
            <Link href="/me/compras/loja" className="underline">
              /me/compras/loja
            </Link>
            .
          </p>
          <p className="mt-2 text-xs text-emerald-100/80">
            Compraste sem conta? Segue o pedido em{" "}
            <Link href="/loja/seguimento" className="underline">
              /loja/seguimento
            </Link>
            .
          </p>
          {checkout?.orderId ? (
            <div className="mt-3">
              <Link
                href={`/me/compras/loja/${checkout.orderId}`}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-200/10 px-4 py-2 text-xs text-emerald-50"
              >
                Ver pedido
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={storeBaseHref}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
        >
          Voltar a loja
        </Link>
      </div>
    </div>
  );
}
