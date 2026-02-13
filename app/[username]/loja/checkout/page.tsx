import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontCheckoutClient from "@/components/storefront/StorefrontCheckoutClient";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function StoreCheckoutPage({ params }: PageProps) {
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
    redirect(`/${username}/loja/checkout`);
  }

  const organization = await prisma.organization.findFirst({
    where: { username, status: "ACTIVE" },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      orgType: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
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
      supportEmail: true,
      supportPhone: true,
      returnPolicy: true,
      privacyPolicy: true,
      termsUrl: true,
    },
  });

  const storeEnabled = isStoreFeatureEnabled();
  const paymentsReady = getPublicStorePaymentsGate({
    orgType: organization.orgType,
    officialEmail: organization.officialEmail,
    officialEmailVerifiedAt: organization.officialEmailVerifiedAt,
    stripeAccountId: organization.stripeAccountId,
    stripeChargesEnabled: organization.stripeChargesEnabled,
    stripePayoutsEnabled: organization.stripePayoutsEnabled,
  }).ok;
  const storePublic = paymentsReady && resolveStoreState(store) === "ACTIVE";
  const displayName =
    organization.publicName || organization.businessName || organization.username || "Loja";

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
            storePolicies={{
              supportEmail: store.supportEmail ?? null,
              supportPhone: store.supportPhone ?? null,
              returnPolicy: store.returnPolicy ?? null,
              privacyPolicy: store.privacyPolicy ?? null,
              termsUrl: store.termsUrl ?? null,
            }}
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
    </main>
  );
}
