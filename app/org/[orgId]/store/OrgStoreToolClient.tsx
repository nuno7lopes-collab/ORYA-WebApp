"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";
import StoreActivationCard from "@/components/store/StoreActivationCard";
import StoreOverviewPanel from "@/components/store/StoreOverviewPanel";
import StoreProductsPanel from "@/components/store/StoreProductsPanel";
import StoreCategoriesPanel from "@/components/store/StoreCategoriesPanel";
import StoreProductImagesPanel from "@/components/store/StoreProductImagesPanel";
import StoreProductVariantsPanel from "@/components/store/StoreProductVariantsPanel";
import StoreProductOptionsPanel from "@/components/store/StoreProductOptionsPanel";
import StoreProductOptionValuesPanel from "@/components/store/StoreProductOptionValuesPanel";
import StoreProductDigitalAssetsPanel from "@/components/store/StoreProductDigitalAssetsPanel";
import StoreOrdersPanel from "@/components/store/StoreOrdersPanel";
import StoreShippingSettingsPanel from "@/components/store/StoreShippingSettingsPanel";
import StoreShippingZonesPanel from "@/components/store/StoreShippingZonesPanel";
import StoreShippingMethodsPanel from "@/components/store/StoreShippingMethodsPanel";
import StoreShippingTiersPanel from "@/components/store/StoreShippingTiersPanel";
import StoreBundlesPanel from "@/components/store/StoreBundlesPanel";
import StoreBundleItemsPanel from "@/components/store/StoreBundleItemsPanel";
import StoreSettingsPanel from "@/components/store/StoreSettingsPanel";

type StoreSnapshot = {
  id: number;
  status: string;
  catalogLocked: boolean;
  checkoutEnabled: boolean;
  showOnProfile: boolean;
  createdAt: string;
  updatedAt: string;
};

type OrgStoreToolClientProps = {
  orgId: number;
};

const STORE_VIEWS = ["overview", "catalog", "orders", "shipping", "marketing", "settings"] as const;
type StoreView = (typeof STORE_VIEWS)[number];

const VIEW_LABELS: Record<StoreView, string> = {
  overview: "Visão geral",
  catalog: "Catálogo",
  orders: "Encomendas",
  shipping: "Envios",
  marketing: "Marketing",
  settings: "Definições",
};

const VIEW_SUBNAV = {
  overview: [] as const,
  catalog: [
    { id: "products", label: "Produtos" },
    { id: "categories", label: "Categorias" },
    { id: "images", label: "Imagens" },
    { id: "variants", label: "Variantes" },
    { id: "options", label: "Opções" },
    { id: "option-values", label: "Valores" },
    { id: "digital-assets", label: "Digitais" },
  ] as const,
  orders: [{ id: "orders", label: "Lista" }] as const,
  shipping: [
    { id: "settings", label: "Configuração" },
    { id: "zones", label: "Zonas" },
    { id: "methods", label: "Métodos" },
    { id: "tiers", label: "Tabelas" },
  ] as const,
  marketing: [
    { id: "bundles", label: "Bundles" },
    { id: "bundle-items", label: "Itens bundle" },
  ] as const,
  settings: [{ id: "preferences", label: "Preferências" }] as const,
} as const;

const DEFAULT_SUB_BY_VIEW: Record<StoreView, string | undefined> = {
  overview: undefined,
  catalog: "products",
  orders: "orders",
  shipping: "settings",
  marketing: "bundles",
  settings: "preferences",
};

function parseStoreView(raw: string | null): StoreView {
  if (!raw) return "overview";
  const normalized = raw.trim().toLowerCase();
  return STORE_VIEWS.includes(normalized as StoreView) ? (normalized as StoreView) : "overview";
}

function parseStoreSub(view: StoreView, raw: string | null) {
  const options = VIEW_SUBNAV[view];
  if (options.length === 0) return undefined;
  const normalized = raw?.trim().toLowerCase();
  const found = normalized ? options.find((entry) => entry.id === normalized) : null;
  if (found) return found.id;
  return DEFAULT_SUB_BY_VIEW[view];
}

export default function OrgStoreToolClient({ orgId }: OrgStoreToolClientProps) {
  const searchParams = useSearchParams();
  const view = parseStoreView(searchParams?.get("view") ?? null);
  const sub = parseStoreSub(view, searchParams?.get("sub") ?? null);
  const subItems = VIEW_SUBNAV[view];
  const storeEnabled = true;

  const endpoints = useMemo(() => {
    const base = `/api/org/${orgId}/store`;
    return {
      base,
      overview: `${base}/overview`,
      categories: `${base}/categories`,
      products: `${base}/products`,
      orders: `${base}/orders`,
      settings: `${base}/settings`,
      shippingSettings: `${base}/shipping/settings`,
      shippingZones: `${base}/shipping/zones`,
      bundles: `${base}/bundles`,
    };
  }, [orgId]);

  const [store, setStore] = useState<StoreSnapshot | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    setLoadingStore(true);
    setStoreError(null);
    try {
      const res = await fetch(endpoints.base, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar a loja.");
      }
      setStore((json.store ?? null) as StoreSnapshot | null);
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingStore(false);
    }
  }, [endpoints.base]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const buildStoreHref = useCallback(
    (nextView: StoreView, nextSub?: string) => {
      const query: Record<string, string> = { view: nextView };
      const resolvedSub = nextSub ?? DEFAULT_SUB_BY_VIEW[nextView];
      if (resolvedSub) {
        query.sub = resolvedSub;
      }
      return buildOrgHref(orgId, "/store", query);
    },
    [orgId],
  );

  const storeLocked = Boolean(store?.catalogLocked);
  const hasStore = Boolean(store);

  const renderPanel = () => {
    if (!hasStore) return null;

    if (view === "overview") {
      return <StoreOverviewPanel endpoint={endpoints.overview} />;
    }

    if (view === "catalog") {
      if (sub === "categories") {
        return (
          <StoreCategoriesPanel
            endpointBase={endpoints.categories}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      if (sub === "images") {
        return (
          <StoreProductImagesPanel
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
            organizationId={orgId}
          />
        );
      }
      if (sub === "variants") {
        return (
          <StoreProductVariantsPanel
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      if (sub === "options") {
        return (
          <StoreProductOptionsPanel
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      if (sub === "option-values") {
        return (
          <StoreProductOptionValuesPanel
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      if (sub === "digital-assets") {
        return (
          <StoreProductDigitalAssetsPanel
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      return (
        <StoreProductsPanel
          endpointBase={endpoints.products}
          categoriesEndpoint={endpoints.categories}
          storeLocked={storeLocked}
          storeEnabled={storeEnabled}
          organizationId={orgId}
        />
      );
    }

    if (view === "orders") {
      return <StoreOrdersPanel endpointBase={endpoints.orders} storeEnabled={storeEnabled} />;
    }

    if (view === "shipping") {
      if (sub === "zones") {
        return <StoreShippingZonesPanel endpointBase={endpoints.shippingZones} storeEnabled={storeEnabled} />;
      }
      if (sub === "methods") {
        return <StoreShippingMethodsPanel zonesEndpoint={endpoints.shippingZones} storeEnabled={storeEnabled} />;
      }
      if (sub === "tiers") {
        return <StoreShippingTiersPanel zonesEndpoint={endpoints.shippingZones} storeEnabled={storeEnabled} />;
      }
      return <StoreShippingSettingsPanel endpoint={endpoints.shippingSettings} storeEnabled={storeEnabled} />;
    }

    if (view === "marketing") {
      if (sub === "bundle-items") {
        return (
          <StoreBundleItemsPanel
            bundlesEndpoint={endpoints.bundles}
            productsEndpoint={endpoints.products}
            storeLocked={storeLocked}
            storeEnabled={storeEnabled}
          />
        );
      }
      return (
        <StoreBundlesPanel
          endpointBase={endpoints.bundles}
          storeLocked={storeLocked}
          storeEnabled={storeEnabled}
        />
      );
    }

    return <StoreSettingsPanel endpoint={endpoints.settings} storeEnabled={storeEnabled} />;
  };

  return (
    <section className="space-y-4 text-white">
      <header className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Loja</p>
            <h1 className="text-2xl font-semibold text-white">{VIEW_LABELS[view]}</h1>
            <p className="text-sm text-white/70">Gestão dedicada da ferramenta de loja.</p>
          </div>
          <Link
            href={buildStoreHref("overview")}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/15"
          >
            Ir para overview
          </Link>
        </div>
      </header>

      {storeError ? (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {storeError}
        </div>
      ) : null}

      {view === "overview" || !hasStore ? (
        <StoreActivationCard
          title="Loja da organização"
          description="Cria, publica e mantém a tua loja pronta para vendas."
          endpoint={endpoints.base}
          storeEnabled={storeEnabled}
          initialStore={store}
          onStoreChange={setStore}
        />
      ) : null}

      {!hasStore ? (
        <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-4 text-sm text-white/75">
          {loadingStore
            ? "A carregar estado da loja..."
            : "Ainda não existe loja criada. Usa o painel acima para criar e desbloquear as restantes secções."}
        </div>
      ) : (
        <>
          {subItems.length > 1 ? (
            <nav className="rounded-2xl border border-white/12 bg-white/5 px-2 py-2">
              <div className="orya-scrollbar-hide flex items-center gap-1 overflow-x-auto">
                {subItems.map((item) => {
                  const active = sub === item.id || (!sub && item.id === DEFAULT_SUB_BY_VIEW[view]);
                  return (
                    <Link
                      key={item.id}
                      href={buildStoreHref(view, item.id)}
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition",
                        active
                          ? "bg-white/15 text-white shadow-[0_10px_28px_rgba(107,255,255,0.25)]"
                          : "text-white/70 hover:bg-white/10",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}

          {renderPanel()}
        </>
      )}
    </section>
  );
}
