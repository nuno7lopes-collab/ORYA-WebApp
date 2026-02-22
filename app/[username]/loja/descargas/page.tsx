import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStoreDigitalEnabled, isStoreFeatureEnabled } from "@/lib/storeAccess";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontDownloadsClient from "@/components/storefront/StorefrontDownloadsClient";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function StoreDownloadsPage({ params }: PageProps) {
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
    redirect(`/${username}/loja/descargas`);
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
    select: { id: true, username: true, publicName: true, businessName: true, brandingAvatarUrl: true },
  });

  if (!organization) {
    notFound();
  }
  const canonicalUsername = organization.username ?? username;
  if (canonicalUsername !== username) {
    redirect(`/${canonicalUsername}/loja/descargas`);
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: { id: true },
  });

  if (!store) {
    notFound();
  }

  const storeEnabled = isStoreFeatureEnabled();
  const storeDigitalEnabled = isStoreDigitalEnabled();
  const downloadsEnabled = storeEnabled && storeDigitalEnabled;
  const displayName =
    organization.publicName ||
    organization.businessName ||
    organization.username ||
    "Loja";

  const baseHref = `/${canonicalUsername}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10">
        <StorefrontHeader
          title={displayName}
          subtitle="Downloads digitais da tua compra"
          cartHref={`${baseHref}/carrinho`}
        />

        <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {!downloadsEnabled ? (
            <p>A funcionalidade da loja esta temporariamente desativada.</p>
          ) : (
            <p>Se compraste um produto digital, podes descarregar aqui.</p>
          )}
        </section>

        {downloadsEnabled ? (
          <div className="mt-8">
            <StorefrontDownloadsClient storeId={store.id} storeBaseHref={baseHref} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
