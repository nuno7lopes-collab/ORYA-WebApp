import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus } from "@prisma/client";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import StoreActivationCard from "@/components/store/StoreActivationCard";
import StoreProductsPanel from "@/components/store/StoreProductsPanel";
import StoreBundlesPanel from "@/components/store/StoreBundlesPanel";
import StoreBundleItemsPanel from "@/components/store/StoreBundleItemsPanel";
import StoreShippingSettingsPanel from "@/components/store/StoreShippingSettingsPanel";
import StoreOrdersPanel from "@/components/store/StoreOrdersPanel";
import StoreOverviewPanel from "@/components/store/StoreOverviewPanel";
import StoreVisibilityToggle from "@/components/store/StoreVisibilityToggle";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = {
  view?: string | string[];
  sub?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

type StoreView = "overview" | "catalog" | "orders" | "shipping" | "marketing" | "settings";

type CatalogSub = "products";

type ShippingSub = "settings";

type MarketingSub = "bundles";

type SettingsSub = "preferences" | "policies";

type OrdersSub = "orders";

const VIEW_SET = new Set<StoreView>([
  "overview",
  "catalog",
  "orders",
  "shipping",
  "marketing",
  "settings",
]);

const CATALOG_SUBS = new Set<CatalogSub>(["products"]);

const SHIPPING_SUBS = new Set<ShippingSub>(["settings"]);
const MARKETING_SUBS = new Set<MarketingSub>(["bundles"]);
const SETTINGS_SUBS = new Set<SettingsSub>(["preferences", "policies"]);
const ORDERS_SUBS = new Set<OrdersSub>(["orders"]);

function resolveView(value?: string): StoreView {
  return VIEW_SET.has(value as StoreView) ? (value as StoreView) : "overview";
}

function resolveSub(view: StoreView, value?: string) {
  if (view === "catalog") {
    return CATALOG_SUBS.has(value as CatalogSub) ? (value as CatalogSub) : "products";
  }
  if (view === "shipping") {
    return SHIPPING_SUBS.has(value as ShippingSub) ? (value as ShippingSub) : "settings";
  }
  if (view === "marketing") {
    return MARKETING_SUBS.has(value as MarketingSub) ? (value as MarketingSub) : "bundles";
  }
  if (view === "settings") {
    return SETTINGS_SUBS.has(value as SettingsSub) ? (value as SettingsSub) : "preferences";
  }
  if (view === "orders") {
    return ORDERS_SUBS.has(value as OrdersSub) ? (value as OrdersSub) : "orders";
  }
  return "overview";
}

export default async function LojaPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const viewParam = Array.isArray(resolvedParams.view) ? resolvedParams.view[0] : resolvedParams.view;
  const subParam = Array.isArray(resolvedParams.sub) ? resolvedParams.sub[0] : resolvedParams.sub;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/organizacao");
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/organizacao/organizations");
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: {
      id: true,
      status: true,
      catalogLocked: true,
      checkoutEnabled: true,
      showOnProfile: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const view = resolveView(viewParam);
  const sub = resolveSub(view, subParam);
  const baseHref = "/organizacao/loja";

  const showActivationCard = !store;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10">
        {showActivationCard ? (
          <StoreActivationCard
            title={organization.publicName || organization.businessName || "Loja da organizacao"}
            description="A tua loja comeca fechada e com o catalogo bloqueado."
            endpoint="/api/organizacao/loja"
            storeEnabled={isStoreFeatureEnabled()}
            initialStore={
              store
                ? {
                    id: store.id,
                    status: store.status,
                    catalogLocked: store.catalogLocked,
                    checkoutEnabled: store.checkoutEnabled,
                    showOnProfile: store.showOnProfile,
                    createdAt: store.createdAt.toISOString(),
                    updatedAt: store.updatedAt.toISOString(),
                  }
                : null
            }
          />
        ) : null}

        {!store ? null : view === "overview" ? (
          <section className="mt-6 space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.26em] text-white/55">Visao geral</p>
                <h2 className="text-xl font-semibold text-white">Resumo rapido</h2>
                <p className="text-sm text-white/65">O essencial da loja num relance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`${baseHref}?view=catalog&sub=products`}
                  className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  Criar produto
                </Link>
                <StoreVisibilityToggle
                  endpoint="/api/organizacao/loja"
                  storeEnabled={isStoreFeatureEnabled()}
                  initialStore={{ showOnProfile: store.showOnProfile }}
                />
              </div>
            </header>
            <StoreOverviewPanel
              endpoint="/api/organizacao/loja/overview"
            />
          </section>
        ) : view === "catalog" ? (
          <section className="mt-6 space-y-4">
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-white/55">Catalogo</p>
              <h2 className="text-xl font-semibold text-white">Produtos</h2>
              <p className="text-sm text-white/65">Cria produtos com imagem, tamanhos e personalizacao.</p>
            </header>
            <StoreProductsPanel
              endpointBase="/api/organizacao/loja/products"
              categoriesEndpoint="/api/organizacao/loja/categories"
              storeLocked={store.catalogLocked}
              storeEnabled={isStoreFeatureEnabled()}
            />
          </section>
        ) : view === "orders" ? (
          <section className="mt-6 space-y-4">
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-white/55">Operacoes</p>
              <h2 className="text-xl font-semibold text-white">Encomendas</h2>
              <p className="text-sm text-white/65">Pagamentos, estados e envios.</p>
            </header>
            <StoreOrdersPanel endpointBase="/api/organizacao/loja/orders" storeEnabled={isStoreFeatureEnabled()} />
          </section>
        ) : view === "shipping" ? (
          <section className="mt-6 space-y-4">
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-white/55">Envios</p>
              <h2 className="text-xl font-semibold text-white">Envios</h2>
              <p className="text-sm text-white/65">Portes simples e intuitivos.</p>
            </header>
            <StoreShippingSettingsPanel
              endpoint="/api/organizacao/loja/shipping/settings"
              storeEnabled={isStoreFeatureEnabled()}
            />
          </section>
        ) : view === "marketing" ? (
          <section className="mt-6 space-y-4">
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-white/55">Marketing</p>
              <h2 className="text-xl font-semibold text-white">Packs e descontos</h2>
              <p className="text-sm text-white/65">Promocoes simples para a loja.</p>
            </header>
            <div className="space-y-4">
              <StoreBundlesPanel
                endpointBase="/api/organizacao/loja/bundles"
                storeLocked={store.catalogLocked}
                storeEnabled={isStoreFeatureEnabled()}
              />
              <StoreBundleItemsPanel
                bundlesEndpoint="/api/organizacao/loja/bundles"
                productsEndpoint="/api/organizacao/loja/products"
                storeLocked={store.catalogLocked}
                storeEnabled={isStoreFeatureEnabled()}
              />
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
                Descontos simples ficam disponiveis numa fase futura.
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-white/55">Definicoes</p>
              <h2 className="text-xl font-semibold text-white">Preferencias</h2>
              <p className="text-sm text-white/65">Politicas e dados da loja.</p>
            </header>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
              Em breve: politicas, termos, email de suporte e outras definicoes da loja.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
