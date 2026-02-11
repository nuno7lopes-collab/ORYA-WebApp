import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { computeBundleTotals } from "@/lib/store/bundles";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontCartOverlay from "@/components/storefront/StorefrontCartOverlay";
import StorefrontBundleCard from "@/components/storefront/StorefrontBundleCard";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";

export const dynamic = "force-dynamic";

type BundleCard = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  pricingMode: string;
  priceCents: number | null;
  percentOff: number | null;
  baseCents: number;
  totalCents: number;
  discountCents: number;
  currency: string;
  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      slug: string;
      images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
    };
    variant: { id: number; label: string | null } | null;
  }>;
};

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function PublicStorePage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = normalizeUsernameInput(rawUsername);

  if (!username) {
    notFound();
  }
  if (username === "me") {
    redirect("/me");
  }
  if (isReservedUsername(username)) {
    notFound();
  }
  if (rawUsername !== username) {
    redirect(`/${username}/loja`);
  }

  const organization = await prisma.organization.findFirst({
    where: { username, status: "ACTIVE" },
    select: { id: true, username: true, publicName: true, businessName: true, brandingAvatarUrl: true },
  });

  if (!organization) {
    notFound();
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: {
      id: true,
      status: true,
      showOnProfile: true,
      catalogLocked: true,
      checkoutEnabled: true,
      currency: true,
      freeShippingThresholdCents: true,
      supportEmail: true,
      supportPhone: true,
      returnPolicy: true,
      privacyPolicy: true,
      termsUrl: true,
    },
  });

  const storeEnabled = isStoreFeatureEnabled();
  const storeState = resolveStoreState(store);
  const storePublic = storeEnabled && storeState === "ACTIVE";
  const storeLocked = Boolean(store?.catalogLocked) || storeState === "LOCKED";
  const storeOpen = storeState === "ACTIVE";
  const storeVisibleOnProfile = Boolean(store?.showOnProfile);
  const displayName =
    organization.publicName || organization.businessName || organization.username || "Loja";

  const categories =
    storePublic && store && !store.catalogLocked
      ? await prisma.storeCategory.findMany({
          where: { storeId: store.id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true },
        })
      : [];

  const products =
    storePublic && store && !store.catalogLocked
      ? await prisma.storeProduct.findMany({
          where: { storeId: store.id, status: "ACTIVE", isVisible: true },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            compareAtPriceCents: true,
            currency: true,
            category: { select: { id: true, name: true, slug: true } },
            images: {
              select: { url: true, altText: true, isPrimary: true, sortOrder: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            },
          },
        })
      : [];

  const bundles =
    storePublic && store && !store.catalogLocked
      ? await prisma.storeBundle.findMany({
          where: { storeId: store.id, status: "ACTIVE", isVisible: true },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            pricingMode: true,
            priceCents: true,
            percentOff: true,
            items: {
              orderBy: [{ id: "asc" }],
              select: {
                id: true,
                quantity: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    priceCents: true,
                    currency: true,
                    status: true,
                    isVisible: true,
                    images: {
                      select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                      take: 1,
                    },
                  },
                },
                variant: { select: { id: true, label: true, priceCents: true, isActive: true } },
              },
            },
          },
        })
      : [];

  const bundleCards = bundles.reduce<BundleCard[]>((acc, bundle) => {
    if (!bundle.items.length) return acc;
    const hasInvalid = bundle.items.some(
      (item) =>
        item.product.status !== "ACTIVE" ||
        !item.product.isVisible ||
        item.product.currency !== store?.currency ||
        (item.variant && !item.variant.isActive),
    );
    if (hasInvalid) return acc;

    const baseCents = bundle.items.reduce((sum, item) => {
      const unitPrice = item.variant?.priceCents ?? item.product.priceCents;
      return sum + unitPrice * item.quantity;
    }, 0);
    const totals = computeBundleTotals({
      pricingMode: bundle.pricingMode,
      priceCents: bundle.priceCents,
      percentOff: bundle.percentOff,
      baseCents,
    });
    if (bundle.items.length < 2 || baseCents <= 0 || totals.totalCents >= baseCents) {
      return acc;
    }

    acc.push({
      id: bundle.id,
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description,
      pricingMode: bundle.pricingMode,
      priceCents: bundle.priceCents,
      percentOff: bundle.percentOff,
      baseCents,
      totalCents: totals.totalCents,
      discountCents: totals.discountCents,
      currency: store?.currency ?? "EUR",
      items: bundle.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          images: item.product.images,
        },
        variant: item.variant ? { id: item.variant.id, label: item.variant.label } : null,
      })),
    });
    return acc;
  }, []);

  const formatMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);

  const storeHasProducts = products.length > 0;
  const storeStatus = !storeEnabled
    ? {
        label: "Loja indisponivel",
        description: "A funcionalidade da loja esta temporariamente desativada.",
        tone: "amber",
      }
    : storeLocked
      ? {
          label: "Catalogo fechado",
          description: "A loja esta em manutencao e sera atualizada em breve.",
          tone: "amber",
        }
      : !storeOpen || !storeVisibleOnProfile
        ? {
            label: "Loja fechada",
            description: "Volta mais tarde para veres os produtos disponiveis.",
            tone: "slate",
          }
        : storeHasProducts
          ? {
              label: "Loja ativa",
              description: "Produtos oficiais e novidades prontos para checkout.",
              tone: "emerald",
            }
          : {
              label: "Produtos em preparacao",
              description: "Os primeiros produtos vao ficar disponiveis em breve.",
              tone: "slate",
            };
  const storeStatusClasses =
    storeStatus.tone === "emerald"
      ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
      : storeStatus.tone === "amber"
        ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
        : "border-white/15 bg-white/10 text-white/70";
  const storeSubtitle = storePublic
    ? "Produtos oficiais e novidades da loja."
    : storeStatus.description;
  const storeStatusBadgeLabel =
    storeStatus.tone === "emerald" ? "Online" : storeStatus.tone === "amber" ? "Indisponivel" : "Em pausa";
  const categorySections = categories
    .map((category) => ({
      ...category,
      products: products.filter((product) => product.category?.id === category.id),
    }))
    .filter((section) => section.products.length > 0);
  const uncategorizedProducts = products.filter((product) => !product.category);
  const hasCategorySections = categorySections.length > 0;
  const gridClass = (count: number) =>
    count <= 3
      ? "flex flex-wrap gap-4"
      : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5";
  const baseHref = `/${username}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10">
        <StorefrontHeader
          title={displayName}
          subtitle={storeSubtitle}
          cartHref={`${baseHref}/carrinho`}
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/60 backdrop-blur-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 uppercase tracking-[0.2em] ${storeStatusClasses}`}>
              {storeStatusBadgeLabel}
            </span>
            <span>Checkout seguro · Pagamentos protegidos</span>
            {storeHasProducts ? (
              <span className="text-white/50">{products.length} produtos</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 uppercase tracking-[0.18em] text-[10px]">
              Loja oficial
            </span>
          </div>
        </div>

        {storePublic && store ? (
          <div className="mt-8 space-y-8">
            {bundleCards.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Bundles</p>
                    <h2 className="text-2xl font-semibold text-white">Conjuntos especiais</h2>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {bundleCards.map((bundle) => (
                    <StorefrontBundleCard key={bundle.id} storeId={store.id} bundle={bundle} />
                  ))}
                </div>
              </section>
            ) : null}
            {categories.length > 0 ? (
              <div className="sticky top-24 z-20">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-2xl">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/50">
                    Categorias
                  </span>
                  {storeHasProducts ? (
                    <a
                      href="#catalogo"
                      className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      Todos
                    </a>
                  ) : null}
                  {categorySections.map((category) => (
                    <a
                      key={category.id}
                      href={`#cat-${category.slug}`}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                    >
                      {category.name}
                    </a>
                  ))}
                  {uncategorizedProducts.length > 0 ? (
                    <a
                      href="#cat-outros"
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                    >
                      Outros
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {storeHasProducts ? (
              <section id="catalogo" className="space-y-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Catalogo</p>
                  <h2 className="text-2xl font-semibold text-white">Produtos da loja</h2>
                </div>
                <div className="space-y-6">
                  {hasCategorySections
                    ? categorySections.map((section) => (
                        <div key={section.id} id={`cat-${section.slug}`} className="space-y-4 scroll-mt-28">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Categoria</p>
                              <h3 className="text-xl font-semibold text-white">{section.name}</h3>
                            </div>
                          </div>
                          <div className={gridClass(section.products.length)}>
                            {section.products.map((product) => {
                              const image = product.images[0];
                              const compareAt = product.compareAtPriceCents ?? null;
                              const hasDiscount =
                                typeof compareAt === "number" && compareAt > product.priceCents;
                              const discount = hasDiscount
                                ? Math.round(((compareAt - product.priceCents) / compareAt) * 100)
                                : null;
                              return (
                                <Link
                                  key={product.id}
                                  href={`${baseHref}/produto/${product.slug}`}
                                  className={`group rounded-2xl border border-white/12 bg-black/35 p-2 transition hover:border-white/35 hover:bg-black/30 ${
                                    section.products.length <= 3
                                      ? "w-[150px] sm:w-[170px] lg:w-[180px]"
                                      : "w-full"
                                  }`}
                                >
                                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                                    {image ? (
                                      <Image
                                        src={image.url}
                                        alt={image.altText || product.name}
                                        fill
                                        sizes="(max-width: 640px) 150px, (max-width: 1024px) 180px, 200px"
                                        className="object-cover transition group-hover:scale-[1.02]"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                                        Sem imagem
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    {discount ? (
                                      <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
                                        -{discount}%
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 space-y-1.5">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[12px] font-semibold text-white line-clamp-2">
                                          {product.name}
                                        </p>
                                        {product.category?.name ? (
                                          <p className="text-[10px] text-white/50">{product.category.name}</p>
                                        ) : null}
                                      </div>
                                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/70 opacity-0 transition group-hover:opacity-100">
                                        Ver
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-white/70">
                                      <span className="text-white">
                                        {formatMoney(product.priceCents, product.currency)}
                                      </span>
                                      {hasDiscount ? (
                                        <span className="text-white/40 line-through">
                                          {formatMoney(compareAt, product.currency)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    : null}
                  {uncategorizedProducts.length > 0 ? (
                    <div id="cat-outros" className="space-y-4 scroll-mt-28">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Categoria</p>
                        <h3 className="text-xl font-semibold text-white">Outros produtos</h3>
                      </div>
                      <div className={gridClass(uncategorizedProducts.length)}>
                        {uncategorizedProducts.map((product) => {
                          const image = product.images[0];
                          const compareAt = product.compareAtPriceCents ?? null;
                          const hasDiscount =
                            typeof compareAt === "number" && compareAt > product.priceCents;
                          const discount = hasDiscount
                            ? Math.round(((compareAt - product.priceCents) / compareAt) * 100)
                            : null;
                          return (
                            <Link
                              key={product.id}
                              href={`${baseHref}/produto/${product.slug}`}
                              className={`group rounded-2xl border border-white/12 bg-black/35 p-2 transition hover:border-white/35 hover:bg-black/30 ${
                                uncategorizedProducts.length <= 3
                                  ? "w-[150px] sm:w-[170px] lg:w-[180px]"
                                  : "w-full"
                              }`}
                            >
                              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                                {image ? (
                                  <Image
                                    src={image.url}
                                    alt={image.altText || product.name}
                                    fill
                                    sizes="(max-width: 640px) 150px, (max-width: 1024px) 180px, 200px"
                                    className="object-cover transition group-hover:scale-[1.02]"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                                    Sem imagem
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                {discount ? (
                                  <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
                                    -{discount}%
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[12px] font-semibold text-white line-clamp-2">
                                      {product.name}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/70 opacity-0 transition group-hover:opacity-100">
                                    Ver
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-white/70">
                                  <span className="text-white">
                                    {formatMoney(product.priceCents, product.currency)}
                                  </span>
                                  {hasDiscount ? (
                                    <span className="text-white/40 line-through">
                                      {formatMoney(compareAt, product.currency)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {!hasCategorySections && uncategorizedProducts.length === 0 ? (
                    <div className={gridClass(products.length)}>
                      {products.map((product) => {
                        const image = product.images[0];
                        const compareAt = product.compareAtPriceCents ?? null;
                        const hasDiscount =
                          typeof compareAt === "number" && compareAt > product.priceCents;
                        const discount = hasDiscount
                          ? Math.round(((compareAt - product.priceCents) / compareAt) * 100)
                          : null;
                        return (
                          <Link
                            key={product.id}
                            href={`${baseHref}/produto/${product.slug}`}
                            className={`group rounded-2xl border border-white/12 bg-black/35 p-2 transition hover:border-white/35 hover:bg-black/30 ${
                              products.length <= 3 ? "w-[150px] sm:w-[170px] lg:w-[180px]" : "w-full"
                            }`}
                          >
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                              {image ? (
                                <Image
                                  src={image.url}
                                  alt={image.altText || product.name}
                                  fill
                                  sizes="(max-width: 640px) 150px, (max-width: 1024px) 180px, 200px"
                                  className="object-cover transition group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                                  Sem imagem
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              {discount ? (
                                <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
                                  -{discount}%
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[12px] font-semibold text-white line-clamp-2">
                                    {product.name}
                                  </p>
                                  {product.category?.name ? (
                                    <p className="text-[10px] text-white/50">{product.category.name}</p>
                                  ) : null}
                                </div>
                                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/70 opacity-0 transition group-hover:opacity-100">
                                  Ver
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-white/70">
                                <span className="text-white">
                                  {formatMoney(product.priceCents, product.currency)}
                                </span>
                                {hasDiscount ? (
                                  <span className="text-white/40 line-through">
                                    {formatMoney(compareAt, product.currency)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/70">
                <h3 className="text-lg font-semibold text-white">Produtos a caminho</h3>
                <p className="mt-2">
                  Estamos a preparar o catalogo desta loja. Volta em breve para ver os primeiros
                  artigos disponiveis.
                </p>
              </section>
            )}
          </div>
        ) : null}
        {storePublic && store ? (
          <StorefrontFooter
            storeName={displayName}
            storePolicies={{
              supportEmail: store.supportEmail ?? null,
              supportPhone: store.supportPhone ?? null,
              returnPolicy: store.returnPolicy ?? null,
              privacyPolicy: store.privacyPolicy ?? null,
              termsUrl: store.termsUrl ?? null,
            }}
          />
        ) : null}
      </div>
      {storePublic && store ? (
        <StorefrontCartOverlay
          storeId={store.id}
          currency={store.currency}
          freeShippingThresholdCents={store.freeShippingThresholdCents}
          storeBaseHref={baseHref}
          checkoutHref={`${baseHref}/checkout`}
        />
      ) : null}
    </main>
  );
}
