import { redirect } from "next/navigation";
import WalletHubClient from "./WalletHubClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

export default async function CarteiraPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const entitlementId =
    typeof resolvedSearchParams?.entitlementId === "string" ? resolvedSearchParams.entitlementId : null;
  if (entitlementId) {
    redirect(`/me/bilhetes/${encodeURIComponent(entitlementId)}`);
  }
  return <WalletHubClient />;
}
