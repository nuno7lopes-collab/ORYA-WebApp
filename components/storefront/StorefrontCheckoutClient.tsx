"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AddressCombobox } from "@/components/ui/address-combobox";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { isInventoryHoldContractEnabledClient } from "@/lib/holds/inventoryContractClient";

type CartItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPriceCents: number;
  variant?: {
    id: number;
    label: string;
    stockQty: number | null;
  } | null;
  product: {
    id: number;
    name: string;
    requiresShipping: boolean;
    stockPolicy?: string;
    stockQty?: number | null;
  };
};

type BundleItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  perBundleQty: number;
  unitPriceCents: number;
  variant?: {
    id: number;
    label: string;
    stockQty: number | null;
  } | null;
  product: {
    id: number;
    name: string;
    requiresShipping: boolean;
    stockPolicy?: string;
    stockQty?: number | null;
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

type InventoryRequirement = {
  productId: number;
  variantId: number | null;
  quantity: number;
  subjectLabel: string;
};

type InventoryHoldEntry = {
  holdId: string;
  expiresAt: string;
  subjectFingerprint: string;
  quantity: number;
  productId: number;
  variantId: number | null;
  subjectLabel: string;
};

type InventoryHoldSession = {
  clientSessionId: string;
  holds: InventoryHoldEntry[];
  updatedAt: string;
};

const INVENTORY_HOLD_STORAGE_KEY = "orya.inventory.hold.v1";
const HOLD_TTL_SECONDS = 5 * 60;
const CLIENT_SESSION_ID_PATTERN = /^[a-zA-Z0-9._:-]{12,128}$/;

const SHIPPING_COUNTRY = "PT";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function createClientSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function isValidClientSessionId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_SESSION_ID_PATTERN.test(value.trim());
}

function readInventoryHoldSession(): InventoryHoldSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(INVENTORY_HOLD_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InventoryHoldSession>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!isValidClientSessionId(parsed.clientSessionId) || !Array.isArray(parsed.holds)) {
      return null;
    }
    const holds = parsed.holds
      .filter((entry): entry is InventoryHoldEntry => {
        if (!entry || typeof entry !== "object") return false;
        const hold = entry as Partial<InventoryHoldEntry>;
        return (
          typeof hold.holdId === "string" &&
          typeof hold.expiresAt === "string" &&
          typeof hold.subjectFingerprint === "string" &&
          typeof hold.quantity === "number" &&
          typeof hold.productId === "number" &&
          (typeof hold.variantId === "number" || hold.variantId === null) &&
          typeof hold.subjectLabel === "string"
        );
      })
      .map((entry) => ({
        ...entry,
        quantity: Math.max(1, Math.trunc(entry.quantity)),
      }));
    return {
      clientSessionId: parsed.clientSessionId.trim(),
      holds,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeInventoryHoldSession(value: InventoryHoldSession | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.sessionStorage.removeItem(INVENTORY_HOLD_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(INVENTORY_HOLD_STORAGE_KEY, JSON.stringify(value));
}

function formatHoldCountdown(targetIso: string) {
  const remaining = Math.max(0, Math.trunc((new Date(targetIso).getTime() - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function holdKey(productId: number, variantId: number | null) {
  return `${productId}:${variantId ?? "base"}`;
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
    legalUrl?: string | null;
    returnPolicy?: string | null;
    privacyPolicy?: string | null;
    termsUrl?: string | null;
  };
}) {
  const inventoryHoldEnabled = isInventoryHoldContractEnabledClient();
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
  const [inventoryHoldSession, setInventoryHoldSession] = useState<InventoryHoldSession | null>(null);
  const [holdTick, setHoldTick] = useState(() => Date.now());

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [shipping, setShipping] = useState({
    fullName: "",
    addressId: null as string | null,
    formattedAddress: "",
    nif: "",
  });
  const [shippingAddressQuery, setShippingAddressQuery] = useState("");
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState({
    fullName: "",
    addressId: null as string | null,
    formattedAddress: "",
    nif: "",
  });
  const [billingAddressQuery, setBillingAddressQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);

  const hasPolicies = Boolean(
      storePolicies?.supportEmail ||
      storePolicies?.supportPhone ||
      storePolicies?.legalUrl ||
      storePolicies?.returnPolicy ||
      storePolicies?.privacyPolicy ||
      storePolicies?.termsUrl,
  );

  const policyLinks = useMemo(() => {
    const links: Array<{ label: string; href: string }> = [];
    const legalUrl =
      storePolicies?.legalUrl ??
      (storePolicies?.termsUrl ? storePolicies.termsUrl.replace(/#.*$/, "") : null);
    if (storePolicies?.termsUrl) {
      links.push({ label: "Termos e condicoes", href: storePolicies.termsUrl });
    }
    if (storePolicies?.returnPolicy && legalUrl) {
      links.push({ label: "Politica de devolucoes", href: `${legalUrl}#loja-devolucoes` });
    }
    if (storePolicies?.privacyPolicy && legalUrl) {
      links.push({ label: "Politica de privacidade", href: `${legalUrl}#privacidade` });
    }
    return links;
  }, [storePolicies?.legalUrl, storePolicies?.termsUrl, storePolicies?.returnPolicy, storePolicies?.privacyPolicy]);

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  useEffect(() => {
    if (!inventoryHoldEnabled) {
      setInventoryHoldSession(null);
      writeInventoryHoldSession(null);
      return;
    }
    const persisted = readInventoryHoldSession();
    if (!persisted) return;
    setInventoryHoldSession(persisted);
  }, [inventoryHoldEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => setHoldTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const requiresShipping = useMemo(
    () =>
      items.some((item) => item.product.requiresShipping) ||
      bundles.some((bundle) => bundle.items.some((item) => item.product.requiresShipping)),
    [items, bundles],
  );
  const inventoryRequirements = useMemo(() => {
    const map = new Map<string, InventoryRequirement>();
    const register = (entry: {
      productId: number;
      variantId: number | null;
      quantity: number;
      subjectLabel: string;
      stockPolicy?: string;
    }) => {
      if (entry.stockPolicy !== "TRACKED") return;
      const key = holdKey(entry.productId, entry.variantId);
      const current = map.get(key);
      map.set(key, {
        productId: entry.productId,
        variantId: entry.variantId,
        quantity: (current?.quantity ?? 0) + Math.max(1, entry.quantity),
        subjectLabel: entry.subjectLabel,
      });
    };

    for (const item of items) {
      register({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        subjectLabel: item.product.name,
        stockPolicy: item.product.stockPolicy,
      });
    }
    for (const bundle of bundles) {
      for (const item of bundle.items) {
        register({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
          subjectLabel: item.product.name,
          stockPolicy: item.product.stockPolicy,
        });
      }
    }
    return Array.from(map.values());
  }, [bundles, items]);

  const activeInventoryHolds = useMemo(() => {
    if (!inventoryHoldSession) return [] as InventoryHoldEntry[];
    return inventoryHoldSession.holds.filter((entry) => {
      const expires = new Date(entry.expiresAt).getTime();
      return Number.isFinite(expires) && expires > holdTick;
    });
  }, [holdTick, inventoryHoldSession]);

  const holdCoverage = useMemo(() => {
    const coverage = new Map<string, number>();
    for (const hold of activeInventoryHolds) {
      const key = holdKey(hold.productId, hold.variantId);
      coverage.set(key, (coverage.get(key) ?? 0) + hold.quantity);
    }
    return coverage;
  }, [activeInventoryHolds]);

  const holdsCoverCurrentCart = useMemo(() => {
    if (inventoryRequirements.length === 0) return false;
    return inventoryRequirements.every((requirement) => {
      const key = holdKey(requirement.productId, requirement.variantId);
      return (holdCoverage.get(key) ?? 0) >= requirement.quantity;
    });
  }, [holdCoverage, inventoryRequirements]);

  const nextHoldExpiry = useMemo(() => {
    if (!activeInventoryHolds.length) return null;
    return activeInventoryHolds
      .map((entry) => new Date(entry.expiresAt).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0] ?? null;
  }, [activeInventoryHolds]);
  const holdCountdown =
    nextHoldExpiry && nextHoldExpiry > Date.now()
      ? formatHoldCountdown(new Date(nextHoldExpiry).toISOString())
      : null;

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
      const res = await fetch(`/api/public/store/cart?storeId=${storeId}`, { cache: "no-store" });
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
      const res = await fetch(`/api/public/store/shipping/methods?${params.toString()}`, { cache: "no-store" });
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
        const res = await fetch(`/api/public/store/checkout/prefill?storeId=${storeId}`, { cache: "no-store" });
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

  const applyShippingGeoDetails = (details: GeoDetailsItem | null) => {
    const resolvedAddressId = details?.addressId ?? null;
    if (!resolvedAddressId) {
      setShipping((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
      return;
    }
    const formatted = (details?.formattedAddress || details?.name || shippingAddressQuery).trim();
    setShipping((prev) => ({ ...prev, addressId: resolvedAddressId, formattedAddress: formatted }));
    if (formatted) {
      setShippingAddressQuery(formatted);
    }
  };

  const applyBillingGeoDetails = (details: GeoDetailsItem | null) => {
    const resolvedAddressId = details?.addressId ?? null;
    if (!resolvedAddressId) {
      setBilling((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
      return;
    }
    const formatted = (details?.formattedAddress || details?.name || billingAddressQuery).trim();
    setBilling((prev) => ({ ...prev, addressId: resolvedAddressId, formattedAddress: formatted }));
    if (formatted) {
      setBillingAddressQuery(formatted);
    }
  };

  useEffect(() => {
    if (!requiresShipping) return;
    void loadShippingMethods(SHIPPING_COUNTRY);
  }, [requiresShipping, subtotalCents]);

  useEffect(() => {
    if (!inventoryHoldEnabled) return;
    if (!inventoryHoldSession) return;
    const active = inventoryHoldSession.holds.filter((entry) => {
      const expires = new Date(entry.expiresAt).getTime();
      return Number.isFinite(expires) && expires > Date.now();
    });
    if (active.length === inventoryHoldSession.holds.length) return;
    if (active.length === 0) {
      setInventoryHoldSession(null);
      writeInventoryHoldSession(null);
      return;
    }
    const next: InventoryHoldSession = {
      ...inventoryHoldSession,
      holds: active,
      updatedAt: new Date().toISOString(),
    };
    setInventoryHoldSession(next);
    writeInventoryHoldSession(next);
  }, [holdTick, inventoryHoldEnabled, inventoryHoldSession]);

  useEffect(() => {
    if (!inventoryHoldEnabled) return;
    if (!inventoryHoldSession?.clientSessionId) return;
    if (!inventoryHoldSession.holds.length) return;
    const interval = window.setInterval(() => {
      void (async () => {
        const active = inventoryHoldSession.holds.filter((entry) => {
          const expires = new Date(entry.expiresAt).getTime();
          return Number.isFinite(expires) && expires > Date.now();
        });
        if (!active.length) return;
        const refreshed = await Promise.all(
          active.map(async (entry) => {
            const res = await fetch("/api/holds/inventory/ping", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                holdId: entry.holdId,
                clientSessionId: inventoryHoldSession.clientSessionId,
              }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) return entry;
            const expiresAt =
              typeof payload?.data?.expiresAt === "string"
                ? payload.data.expiresAt
                : typeof payload?.expiresAt === "string"
                  ? payload.expiresAt
                  : entry.expiresAt;
            return { ...entry, expiresAt };
          }),
        );
        const next: InventoryHoldSession = {
          ...inventoryHoldSession,
          holds: refreshed,
          updatedAt: new Date().toISOString(),
        };
        setInventoryHoldSession(next);
        writeInventoryHoldSession(next);
      })();
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [inventoryHoldEnabled, inventoryHoldSession]);

  const releaseInventorySessionHolds = async (session: InventoryHoldSession | null) => {
    if (!session?.clientSessionId || !session.holds.length) return;
    await Promise.all(
      session.holds.map((entry) =>
        fetch("/api/holds/inventory/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holdId: entry.holdId,
            clientSessionId: session.clientSessionId,
          }),
        }).catch(() => null),
      ),
    );
  };

  const rollbackCreatedInventoryHolds = async (
    clientSessionId: string,
    created: InventoryHoldEntry[],
  ) => {
    if (!created.length) return;
    await Promise.all(
      created.map((entry) =>
        fetch("/api/holds/inventory/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holdId: entry.holdId,
            clientSessionId,
          }),
        }).catch(() => null),
      ),
    );
  };

  const extractInventoryHoldError = (params: {
    status: number;
    responsePayload: unknown;
    rawBody: string;
    fallback: string;
  }) => {
    const { status, responsePayload, rawBody, fallback } = params;
    const payload =
      responsePayload && typeof responsePayload === "object"
        ? (responsePayload as Record<string, unknown>)
        : null;
    const details =
      payload?.details && typeof payload.details === "object"
        ? (payload.details as Record<string, unknown>)
        : null;
    const nestedData =
      payload?.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : null;

    const textCandidates = [
      payload?.message,
      payload?.error,
      details?.message,
      nestedData?.message,
      nestedData?.error,
    ];
    for (const candidate of textCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    if (typeof rawBody === "string" && rawBody.trim() && !rawBody.trim().startsWith("<")) {
      return rawBody.trim().slice(0, 220);
    }

    if (status >= 500) {
      return "Serviço de reserva de stock temporariamente indisponível. Tenta novamente em instantes.";
    }
    return fallback;
  };

  const ensureInventoryHolds = async () => {
    if (!inventoryHoldEnabled || !inventoryRequirements.length) {
      return { ok: true as const, clientSessionId: null, holdIds: [] as string[] };
    }

    if (inventoryHoldSession && activeInventoryHolds.length && holdsCoverCurrentCart) {
      return {
        ok: true as const,
        clientSessionId: inventoryHoldSession.clientSessionId,
        holdIds: activeInventoryHolds.map((entry) => entry.holdId),
      };
    }

    if (inventoryHoldSession?.holds.length) {
      await releaseInventorySessionHolds(inventoryHoldSession);
      setInventoryHoldSession(null);
      writeInventoryHoldSession(null);
    }

    const clientSessionId =
      isValidClientSessionId(inventoryHoldSession?.clientSessionId)
        ? inventoryHoldSession!.clientSessionId
        : createClientSessionId();
    const createdHolds: InventoryHoldEntry[] = [];

    for (const requirement of inventoryRequirements) {
      let res: Response;
      try {
        res = await fetch("/api/holds/inventory/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            productId: requirement.productId,
            variantId: requirement.variantId,
            quantity: requirement.quantity,
            clientSessionId,
            metadata: { subjectLabel: requirement.subjectLabel },
          }),
        });
      } catch {
        await rollbackCreatedInventoryHolds(clientSessionId, createdHolds);
        return {
          ok: false as const,
          message: "Falha de ligação ao reservar stock para checkout. Verifica a ligação e tenta novamente.",
        };
      }

      const rawBody = await res.text().catch(() => "");
      const payload = (() => {
        if (!rawBody) return null;
        try {
          return JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return null;
        }
      })();
      const data =
        payload && typeof payload === "object"
          ? ((payload.data ?? payload) as Record<string, unknown>)
          : null;
      if (!res.ok) {
        await rollbackCreatedInventoryHolds(clientSessionId, createdHolds);
        const message = extractInventoryHoldError({
          status: res.status,
          responsePayload: payload,
          rawBody,
          fallback: "Não foi possível reservar stock para checkout.",
        });
        return { ok: false as const, message };
      }
      const holdRequired = data?.holdRequired !== false;
      if (!holdRequired) continue;
      const holdId = typeof data?.holdId === "string" ? data.holdId : null;
      const expiresAt =
        typeof data?.expiresAt === "string" ? data.expiresAt : null;
      const subjectFingerprint =
        typeof data?.subjectFingerprint === "string"
          ? data.subjectFingerprint
          : null;
      if (!holdId || !expiresAt || !subjectFingerprint) {
        await rollbackCreatedInventoryHolds(clientSessionId, createdHolds);
        return {
          ok: false as const,
          message: "Resposta inválida ao criar hold de inventory.",
        };
      }
      createdHolds.push({
        holdId,
        expiresAt,
        subjectFingerprint,
        quantity: requirement.quantity,
        productId: requirement.productId,
        variantId: requirement.variantId,
        subjectLabel: requirement.subjectLabel,
      });
    }

    const next: InventoryHoldSession = {
      clientSessionId,
      holds: createdHolds,
      updatedAt: new Date().toISOString(),
    };
    setInventoryHoldSession(next);
    writeInventoryHoldSession(next);

    return {
      ok: true as const,
      clientSessionId,
      holdIds: createdHolds.map((entry) => entry.holdId),
    };
  };

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
      const ensuredHolds = await ensureInventoryHolds();
      if (!ensuredHolds.ok) {
        throw new Error(ensuredHolds.message);
      }

      const res = await fetch(`/api/public/store/checkout?storeId=${storeId}`, {
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
          clientSessionId: ensuredHolds.clientSessionId,
          inventoryHoldIds: ensuredHolds.holdIds,
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

      {!checkout &&
        inventoryHoldEnabled &&
        inventoryRequirements.length > 0 &&
        activeInventoryHolds.length > 0 &&
        holdsCoverCurrentCart && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-semibold">Stock reservado para checkout.</p>
          <p className="mt-1 text-emerald-100/90">
            Tempo restante: {holdCountdown ?? `${Math.floor(HOLD_TTL_SECONDS / 60)}:00`}
          </p>
          <button
            type="button"
            onClick={() => void handleStartCheckout()}
            className="mt-3 rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50 hover:bg-emerald-400/20"
          >
            Voltar ao checkout
          </button>
        </div>
      )}

      {!checkout &&
        inventoryHoldEnabled &&
        inventoryRequirements.length > 0 &&
        inventoryHoldSession &&
        activeInventoryHolds.length === 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          O seu bloqueio expirou - o stock já não está reservado.
        </div>
      )}

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
                  <AddressCombobox
                    label="Morada (Apple Maps)"
                    value={shippingAddressQuery}
                    onValueChange={(next) => {
                      setShippingAddressQuery(next);
                      setShipping((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
                    }}
                    addressId={shipping.addressId}
                    onAddressIdChange={(next) => setShipping((prev) => ({ ...prev, addressId: next }))}
                    onDetailsResolved={applyShippingGeoDetails}
                    inputClassName="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Procura um local ou morada"
                  />
                  {shipping.addressId && (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                      Morada confirmada: {shipping.formattedAddress || shippingAddressQuery}
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
                    <AddressCombobox
                      label="Morada (Apple Maps)"
                      value={billingAddressQuery}
                      onValueChange={(next) => {
                        setBillingAddressQuery(next);
                        setBilling((prev) => ({ ...prev, addressId: null, formattedAddress: "" }));
                      }}
                      addressId={billing.addressId}
                      onAddressIdChange={(next) => setBilling((prev) => ({ ...prev, addressId: next }))}
                      onDetailsResolved={applyBillingGeoDetails}
                      inputClassName="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      placeholder="Procura um local ou morada"
                    />
                    {billing.addressId && (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                        Morada confirmada: {billing.formattedAddress || billingAddressQuery}
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
