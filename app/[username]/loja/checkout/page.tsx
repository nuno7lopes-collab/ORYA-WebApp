import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontCheckoutClient from "@/components/storefront/StorefrontCheckoutClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function StoreCheckoutPage({ params }: PageProps) {
  const resolvedParams = await params;
  const username = resolvedParams?.username;

  if (!username || username.toLowerCase() === "me") {
    redirect("/me");
  }

  const [profile, organization] = await Promise.all([
    prisma.profile.findUnique({
      where: { username },
      select: { id: true, username: true, fullName: true },
    }),
    prisma.organization.findFirst({
      where: { username, status: "ACTIVE" },
      select: { id: true, username: true, publicName: true, businessName: true },
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

  if (!store || !storeEnabled || !storePublic || store.catalogLocked) {
    return (
      <main className="min-h-screen w-full text-white">
        <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
          <StorefrontHeader title={displayName} subtitle="Loja fechada." cartHref={`/${username}/loja/carrinho`} />
          <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            Loja fechada. Volta mais tarde para veres os produtos disponíveis.
          </div>
        </div>
      </main>
    );
  }

  const baseHref = `/${username}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <StorefrontHeader title={displayName} subtitle="Checkout" cartHref={baseHref + "/carrinho"} />
        <div className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <StorefrontCheckoutClient
            storeId={store.id}
            currency={store.currency}
            storeBaseHref={baseHref}
            cartHref={baseHref + "/carrinho"}
          />
        </div>
      </div>
    </main>
  );
}
