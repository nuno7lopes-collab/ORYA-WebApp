import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import StorefrontDownloadsClient from "@/components/storefront/StorefrontDownloadsClient";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";

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
        select: { id: true, status: true, showOnProfile: true, catalogLocked: true },
      })
    : profile
      ? await prisma.store.findFirst({
          where: { ownerUserId: profile.id },
          select: { id: true, status: true, showOnProfile: true, catalogLocked: true },
        })
      : null;

  if (!store) {
    notFound();
  }

  const storeEnabled = isStoreFeatureEnabled();
  const displayName =
    organization?.publicName ||
    organization?.businessName ||
    organization?.username ||
    profile?.fullName ||
    profile?.username ||
    "Loja";

  const baseHref = `/${username}/loja`;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10">
        <StorefrontHeader
          title={displayName}
          subtitle="Downloads digitais da tua compra"
          cartHref={`${baseHref}/carrinho`}
        />

        <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-6 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {!storeEnabled ? (
            <p>A funcionalidade da loja esta temporariamente desativada.</p>
          ) : (
            <p>Se compraste um produto digital, podes descarregar aqui.</p>
          )}
        </section>

        {storeEnabled ? (
          <div className="mt-8">
            <StorefrontDownloadsClient storeId={store.id} storeBaseHref={baseHref} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
