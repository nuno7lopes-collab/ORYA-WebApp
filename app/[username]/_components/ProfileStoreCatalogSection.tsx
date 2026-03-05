import Image from "next/image";
import Link from "next/link";

type StoreCategory = {
  id: number;
  name: string;
  slug: string;
};

type StoreProduct = {
  id: number;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  category: {
    id: number;
    name: string;
    slug: string;
  } | null;
  images: Array<{
    url: string;
    altText: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

type ProfileStoreCatalogSectionProps = {
  username: string;
  categories: StoreCategory[];
  products: StoreProduct[];
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function resolvePrimaryImage(product: StoreProduct) {
  const sorted = [...product.images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  return sorted[0] ?? null;
}

function resolveDiscount(product: StoreProduct) {
  const compareAt = product.compareAtPriceCents;
  const hasDiscount = typeof compareAt === "number" && compareAt > product.priceCents;
  if (!hasDiscount || !compareAt) {
    return { hasDiscount: false as const, compareAt: null, percentage: null };
  }
  return {
    hasDiscount: true as const,
    compareAt,
    percentage: Math.round(((compareAt - product.priceCents) / compareAt) * 100),
  };
}

function productGridClass(count: number) {
  if (count <= 2) return "grid gap-4 sm:grid-cols-2";
  if (count === 3) return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
  return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ProductCard({
  href,
  product,
}: {
  href: string;
  product: StoreProduct;
}) {
  const image = resolvePrimaryImage(product);
  const discount = resolveDiscount(product);

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[linear-gradient(170deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-2 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/45 hover:shadow-[0_16px_32px_rgba(6,182,212,0.22)]"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[16px] border border-white/12 bg-black/35">
        {image ? (
          <Image
            src={image.url}
            alt={image.altText || product.name}
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 48vw, (max-width: 1536px) 32vw, 24vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">Sem imagem</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        {discount.percentage ? (
          <span className="absolute left-3 top-3 rounded-full border border-emerald-300/35 bg-emerald-400/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
            -{discount.percentage}%
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 rounded-full border border-white/18 bg-black/45 px-2.5 py-1 text-[10px] text-white/85">
          {product.category?.name ?? "Sem categoria"}
        </span>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-between gap-3 px-1 pb-1">
        <div className="space-y-1">
          <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-white">{product.name}</p>
          <p className="text-[11px] text-white/62">Entrega rapida e pagamento seguro.</p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">{formatMoney(product.priceCents, product.currency)}</p>
            {discount.hasDiscount && discount.compareAt ? (
              <p className="text-[11px] text-white/45 line-through">{formatMoney(discount.compareAt, product.currency)}</p>
            ) : null}
          </div>

          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 transition sm:opacity-0 sm:group-hover:opacity-100">
            Ver produto
          </span>
        </div>
      </div>
    </Link>
  );
}

function HighlightCard({ href, product }: { href: string; product: StoreProduct }) {
  const image = resolvePrimaryImage(product);
  const discount = resolveDiscount(product);

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[26px] border border-white/18 bg-black/45"
    >
      {image ? (
        <Image
          src={image.url}
          alt={image.altText || product.name}
          fill
          sizes="(max-width: 1024px) 100vw, 80vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="h-full min-h-[220px] w-full bg-black/50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#010A19]/90 via-[#010A19]/65 to-[#010A19]/25" />
      <div className="relative flex min-h-[220px] flex-col justify-end p-5 sm:min-h-[250px] sm:p-7">
        <span className="mb-3 inline-flex w-fit rounded-full border border-cyan-300/40 bg-cyan-400/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
          Selecao da semana
        </span>
        <h4 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-3xl">{product.name}</h4>
        <p className="mt-2 text-sm text-white/82">{product.category?.name ?? "Produto oficial"} para elevar o teu jogo.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold text-white">{formatMoney(product.priceCents, product.currency)}</span>
          {discount.hasDiscount && discount.compareAt ? (
            <span className="text-sm text-white/55 line-through">{formatMoney(discount.compareAt, product.currency)}</span>
          ) : null}
          {discount.percentage ? (
            <span className="rounded-full border border-emerald-300/35 bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-100">
              -{discount.percentage}%
            </span>
          ) : null}
          <span className="rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/92">
            Ver produto
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ProfileStoreCatalogSection({
  username,
  categories,
  products,
}: ProfileStoreCatalogSectionProps) {
  const baseHref = `/${username}/loja`;

  const categorySections = categories
    .map((category) => ({
      ...category,
      products: products.filter((product) => product.category?.id === category.id),
    }))
    .filter((section) => section.products.length > 0);

  const uncategorizedProducts = products.filter((product) => !product.category);
  const hasCategorySections = categorySections.length > 0;
  const highlightedProduct =
    products.find((product) => resolveDiscount(product).hasDiscount) ?? products[0] ?? null;
  const visibleCategoryCount = categorySections.length + (uncategorizedProducts.length > 0 ? 1 : 0);
  const discountedCount = products.filter((product) => resolveDiscount(product).hasDiscount).length;

  return (
    <section className="space-y-6 pb-2">
      <div className="overflow-hidden rounded-[30px] border border-white/15 bg-[radial-gradient(circle_at_10%_0%,rgba(8,145,178,0.18),transparent_45%),linear-gradient(165deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/80">Catalogo</p>
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">Loja oficial</h3>
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">
              Equipamento selecionado para jogadores e equipas, com promocoes ativas e entregas rapidas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] text-white/92">
              {formatCount(products.length, "produto", "produtos")}
            </span>
            <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[11px] text-white/84">
              {formatCount(visibleCategoryCount, "categoria", "categorias")}
            </span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1.5 text-[11px] text-emerald-100">
              {formatCount(discountedCount, "promocao", "promocoes")}
            </span>
          </div>
        </div>

        {highlightedProduct ? (
          <div className="mt-5">
            <HighlightCard href={`${baseHref}/produto/${highlightedProduct.slug}`} product={highlightedProduct} />
          </div>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-white/18 bg-white/[0.04] p-4 text-[13px] text-white/85">
          Sem produtos publicos disponiveis neste momento.
        </div>
      ) : (
        <>
          {(categorySections.length > 0 || uncategorizedProducts.length > 0) && (
            <div className="sticky top-24 z-20">
              <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-black/45 px-3 py-2 backdrop-blur-2xl">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">Categorias</span>
                <a
                  href="#catalogo"
                  className="whitespace-nowrap rounded-full border border-white/25 bg-white/16 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  Todos ({products.length})
                </a>
                {categorySections.map((category) => (
                  <a
                    key={category.id}
                    href={`#cat-${category.slug}`}
                    className="whitespace-nowrap rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] text-white/78 transition hover:border-cyan-300/45 hover:text-white"
                  >
                    {category.name} ({category.products.length})
                  </a>
                ))}
                {uncategorizedProducts.length > 0 ? (
                  <a
                    href="#cat-outros"
                    className="whitespace-nowrap rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] text-white/78 transition hover:border-cyan-300/45 hover:text-white"
                  >
                    Outros ({uncategorizedProducts.length})
                  </a>
                ) : null}
              </div>
            </div>
          )}

          <div id="catalogo" className="space-y-6">
            {hasCategorySections
              ? categorySections.map((section) => (
                  <div
                    key={section.id}
                    id={`cat-${section.slug}`}
                    className="scroll-mt-28 rounded-[26px] border border-white/14 bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 sm:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">Categoria</p>
                        <h4 className="text-xl font-semibold text-white">{section.name}</h4>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/82">
                        {formatCount(section.products.length, "produto", "produtos")}
                      </span>
                    </div>
                    <div className={productGridClass(section.products.length)}>
                      {section.products.map((product) => (
                        <ProductCard key={product.id} href={`${baseHref}/produto/${product.slug}`} product={product} />
                      ))}
                    </div>
                  </div>
                ))
              : null}

            {uncategorizedProducts.length > 0 ? (
              <div
                id="cat-outros"
                className="scroll-mt-28 rounded-[26px] border border-white/14 bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">Categoria</p>
                    <h4 className="text-xl font-semibold text-white">Outros produtos</h4>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/82">
                    {formatCount(uncategorizedProducts.length, "produto", "produtos")}
                  </span>
                </div>
                <div className={productGridClass(uncategorizedProducts.length)}>
                  {uncategorizedProducts.map((product) => (
                    <ProductCard key={product.id} href={`${baseHref}/produto/${product.slug}`} product={product} />
                  ))}
                </div>
              </div>
            ) : null}

            {!hasCategorySections && uncategorizedProducts.length === 0 ? (
              <div className={productGridClass(products.length)}>
                {products.map((product) => (
                  <ProductCard key={product.id} href={`${baseHref}/produto/${product.slug}`} product={product} />
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
