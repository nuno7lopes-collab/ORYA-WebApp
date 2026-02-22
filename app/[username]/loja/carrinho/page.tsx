import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontCartOverlay from "@/components/storefront/StorefrontCartOverlay";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { resolveStorePolicy } from "@/lib/store/policySettings";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function StoreCartPage({ params }: PageProps) {
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
    redirect(`/${username}/loja/carrinho`);
  }

  const resolvedOrganization = await resolveUsernameOwner(username, {
    expectedOwnerType: "organization",
    includeDeletedUser: false,
    requireActiveOrganization: true,
    backfillGlobalUsername: false,
  });
  if (resolvedOrganization?.ownerType !== "organization") {
    notFound();
  }

  const organization = await prisma.organization.findUnique({
    where: { id: resolvedOrganization.ownerId },
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
  const canonicalUsername = organization.username ?? username;
  if (canonicalUsername !== username) {
    redirect(`/${canonicalUsername}/loja/carrinho`);
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
    },
  });

  const organizationSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId: organization.id },
    select: {
      supportEmail: true,
      supportPhone: true,
      storeReturnPolicyMode: true,
      storeReturnWindowDays: true,
    },
  });
  const storePolicy = resolveStorePolicy({
    settings: organizationSettings,
    fallbackSupportEmail: organization.officialEmail ?? null,
    organizationUsername: organization.username ?? null,
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
          <StorefrontHeader
            title={displayName}
            subtitle="Loja fechada."
            cartHref={`/${canonicalUsername}/loja/carrinho`}
          />
          <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            Loja fechada. Volta mais tarde para veres os produtos disponíveis.
          </div>
        </div>
      </main>
    );
  }

  const baseHref = `/${canonicalUsername}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <StorefrontHeader title={displayName} subtitle="Carrinho" cartHref={baseHref + "/carrinho"} />
        <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          O carrinho aparece compacto no canto direito. Podes minimizar ou abrir para rever o pedido.
        </div>
        <StorefrontFooter
          storeName={displayName}
          storePolicies={{
            supportEmail: storePolicy.supportEmail,
            supportPhone: storePolicy.supportPhone,
            legalUrl: storePolicy.legalUrl,
            returnPolicy: storePolicy.returnPolicy,
            privacyPolicy: storePolicy.privacyPolicy,
            termsUrl: storePolicy.termsUrl,
          }}
        />
      </div>
      <StorefrontCartOverlay
        storeId={store.id}
        currency={store.currency}
        freeShippingThresholdCents={store.freeShippingThresholdCents}
        storeBaseHref={baseHref}
        checkoutHref={baseHref + "/checkout"}
        defaultOpen
      />
    </main>
  );
}
