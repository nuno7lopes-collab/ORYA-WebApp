import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontCartOverlay from "@/components/storefront/StorefrontCartOverlay";
import StorefrontProductClient from "@/components/storefront/StorefrontProductClient";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string; slug: string } | Promise<{ username: string; slug: string }>;
};

export default async function StoreProductPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = normalizeUsernameInput(rawUsername);
  const slug = resolvedParams?.slug;

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
    redirect(`/${username}/loja/produto/${encodeURIComponent(slug ?? "")}`);
  }

  const organization = await prisma.organization.findFirst({
    where: { username, status: "ACTIVE" },
    select: { id: true, username: true, publicName: true, businessName: true },
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
  const storePublic = resolveStoreState(store) === "ACTIVE";
  const displayName =
    organization.publicName || organization.businessName || organization.username || "Loja";

  if (!store || !storeEnabled || !storePublic || store.catalogLocked) {
    return (
      <main className="min-h-screen w-full text-white">
        <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
          <StorefrontHeader
            title={displayName}
            subtitle="Loja fechada ou catalogo indisponivel."
            cartHref={`/${username}/loja/carrinho`}
          />
          <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            Loja fechada. Volta mais tarde para veres os produtos disponíveis.
          </div>
        </div>
      </main>
    );
  }

  if (!slug) {
    notFound();
  }

  const product = await prisma.storeProduct.findFirst({
    where: { storeId: store.id, slug, status: "ACTIVE", isVisible: true },
    select: {
      id: true,
      name: true,
      priceCents: true,
      compareAtPriceCents: true,
      shortDescription: true,
      description: true,
      requiresShipping: true,
      stockPolicy: true,
      stockQty: true,
      category: { select: { name: true } },
      images: {
        select: { url: true, altText: true, isPrimary: true, sortOrder: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }],
        select: { id: true, label: true, priceCents: true, stockQty: true, isActive: true },
      },
      options: {
        orderBy: [{ sortOrder: "asc" }],
        select: {
          id: true,
          label: true,
          optionType: true,
          required: true,
          maxLength: true,
          minValue: true,
          maxValue: true,
          priceDeltaCents: true,
          values: {
            orderBy: [{ sortOrder: "asc" }],
            select: { id: true, value: true, label: true, priceDeltaCents: true },
          },
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const defaultShipping = await prisma.storeShippingMethod.findFirst({
    where: { zone: { storeId: store.id, isActive: true } },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: { etaMinDays: true, etaMaxDays: true },
  });
  const shippingEta = defaultShipping
    ? { minDays: defaultShipping.etaMinDays, maxDays: defaultShipping.etaMaxDays }
    : null;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <StorefrontHeader
          title={displayName}
          subtitle="Detalhe do produto"
          cartHref={`/${username}/loja/carrinho`}
        />
        <Link
          href={`/${username}/loja`}
          className="text-sm text-white/60 hover:text-white/90"
        >
          ← Voltar a loja
        </Link>
        <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl lg:p-8">
          <StorefrontProductClient
            storeId={store.id}
            currency={store.currency}
            product={{
              id: product.id,
              name: product.name,
              categoryName: product.category?.name ?? null,
              priceCents: product.priceCents,
              compareAtPriceCents: product.compareAtPriceCents,
              shortDescription: product.shortDescription,
              description: product.description,
              requiresShipping: product.requiresShipping,
              stockPolicy: product.stockPolicy,
              stockQty: product.stockQty,
              images: product.images,
            }}
            variants={product.variants}
            options={product.options}
            cartHref={`/${username}/loja/carrinho`}
            shippingEta={shippingEta}
          />
        </div>
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
      </div>
      <StorefrontCartOverlay
        storeId={store.id}
        currency={store.currency}
        freeShippingThresholdCents={store.freeShippingThresholdCents}
        storeBaseHref={`/${username}/loja`}
        checkoutHref={`/${username}/loja/checkout`}
      />
    </main>
  );
}
