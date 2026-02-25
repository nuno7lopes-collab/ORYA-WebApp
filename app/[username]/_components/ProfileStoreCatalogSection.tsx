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

function gridClass(count: number) {
  return count <= 3
    ? "flex flex-wrap gap-4"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5";
}

function ProductCard({
  href,
  product,
  compact,
}: {
  href: string;
  product: StoreProduct;
  compact: boolean;
}) {
  const image = product.images[0] ?? null;
  const compareAt = product.compareAtPriceCents;
  const hasDiscount = typeof compareAt === "number" && compareAt > product.priceCents;
  const discount = hasDiscount ? Math.round(((compareAt - product.priceCents) / compareAt) * 100) : null;

  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-white/12 bg-black/35 p-2 transition hover:border-white/35 hover:bg-black/30 ${
        compact ? "w-[150px] sm:w-[170px] lg:w-[180px]" : "w-full"
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
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">Sem imagem</div>
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
            <p className="line-clamp-2 text-[12px] font-semibold text-white">{product.name}</p>
            {product.category?.name ? <p className="text-[10px] text-white/50">{product.category.name}</p> : null}
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/70 opacity-0 transition group-hover:opacity-100">
            Ver
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/70">
          <span className="text-white">{formatMoney(product.priceCents, product.currency)}</span>
          {hasDiscount && compareAt ? (
            <span className="text-white/40 line-through">{formatMoney(compareAt, product.currency)}</span>
          ) : null}
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/65">Catalogo</p>
          <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Produtos</h3>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/85">
          {products.length} {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-white/18 bg-white/[0.04] p-4 text-[13px] text-white/85">
          Sem produtos publicos disponiveis neste momento.
        </div>
      ) : (
        <>
          {(categorySections.length > 0 || uncategorizedProducts.length > 0) && (
            <div className="sticky top-24 z-20">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-2xl">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">Categorias</span>
                <a
                  href="#catalogo"
                  className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  Todos
                </a>
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
          )}

          <div id="catalogo" className="space-y-6">
            {hasCategorySections
              ? categorySections.map((section) => (
                  <div key={section.id} id={`cat-${section.slug}`} className="space-y-4 scroll-mt-28">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Categoria</p>
                      <h4 className="text-lg font-semibold text-white">{section.name}</h4>
                    </div>
                    <div className={gridClass(section.products.length)}>
                      {section.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          href={`${baseHref}/produto/${product.slug}`}
                          product={product}
                          compact={section.products.length <= 3}
                        />
                      ))}
                    </div>
                  </div>
                ))
              : null}

            {uncategorizedProducts.length > 0 ? (
              <div id="cat-outros" className="space-y-4 scroll-mt-28">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Categoria</p>
                  <h4 className="text-lg font-semibold text-white">Outros produtos</h4>
                </div>
                <div className={gridClass(uncategorizedProducts.length)}>
                  {uncategorizedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      href={`${baseHref}/produto/${product.slug}`}
                      product={product}
                      compact={uncategorizedProducts.length <= 3}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!hasCategorySections && uncategorizedProducts.length === 0 ? (
              <div className={gridClass(products.length)}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    href={`${baseHref}/produto/${product.slug}`}
                    product={product}
                    compact={products.length <= 3}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
