import { redirect } from "next/navigation";
import WalletHubClient from "./WalletHubClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CarteiraPage({ searchParams }: PageProps) {
  const entitlementId =
    typeof searchParams?.entitlementId === "string" ? searchParams.entitlementId : null;
  if (entitlementId) {
    redirect(`/me/bilhetes/${encodeURIComponent(entitlementId)}`);
  }
  return <WalletHubClient />;
}
