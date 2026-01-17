import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function PublicStorePage({ params }: PageProps) {
  const resolvedParams = await params;
  const username = resolvedParams?.username;

  if (!username || username.toLowerCase() === "me") {
    redirect("/me");
  }

  const [profile, organization] = await Promise.all([
    prisma.profile.findUnique({
      where: { username },
      select: { id: true, username: true, fullName: true, avatarUrl: true },
    }),
    prisma.organization.findFirst({
      where: { username, status: "ACTIVE" },
      select: { id: true, username: true, publicName: true, businessName: true, brandingAvatarUrl: true },
    }),
  ]);

  if (!profile && !organization) {
    notFound();
  }

  const store = organization
    ? await prisma.store.findFirst({
        where: { ownerOrganizationId: organization.id },
        select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
      })
    : profile
      ? await prisma.store.findFirst({
          where: { ownerUserId: profile.id },
          select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
        })
      : null;

  const storeEnabled = isStoreFeatureEnabled();
  const storePublic = isStorePublic(store);
  const displayName =
    organization?.publicName || organization?.businessName || organization?.username || profile?.fullName || profile?.username || "Loja";

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

  const formatMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);

  const baseHref = `/${username}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10">
        <StorefrontHeader
          title={displayName}
          subtitle={storePublic ? "Produtos oficiais e novidades da loja." : "Esta loja ainda nao esta ativa."}
          cartHref={`${baseHref}/carrinho`}
        />

        <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {!storeEnabled ? (
            <p>A funcionalidade da loja está temporariamente desativada.</p>
          ) : !storePublic || store?.catalogLocked ? (
            <p>Loja fechada. Volta mais tarde para veres os produtos disponíveis.</p>
          ) : (
            <p>Loja ativa. Explora os produtos em baixo.</p>
          )}
        </section>

        {storePublic && store && !store.catalogLocked ? (
          <div className="mt-8 space-y-8">
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const image = product.images[0];
                return (
                  <Link
                    key={product.id}
                    href={`${baseHref}/produto/${product.slug}`}
                    className="group rounded-3xl border border-white/12 bg-black/30 p-4 transition hover:border-white/35"
                  >
                    <div className="h-40 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      {image ? (
                        <img
                          src={image.url}
                          alt={image.altText || product.name}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-sm font-semibold text-white">{product.name}</p>
                      <p className="text-xs text-white/60">
                        {formatMoney(product.priceCents, product.currency)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
