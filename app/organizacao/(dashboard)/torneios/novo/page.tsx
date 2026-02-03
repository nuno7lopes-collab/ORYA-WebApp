import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref, resolveOrganizationIdFromSearchParams } from "@/lib/organizationId";
import PadelTournamentWizardClient from "@/app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function OrganizationTorneiosNovoPage({ searchParams }: Props) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const orgId = resolveOrganizationIdFromSearchParams(resolvedSearchParams);
  if (!orgId) {
    const target = await appendOrganizationIdToRedirectHref("/organizacao/torneios/novo", resolvedSearchParams);
    redirect(target);
  }
  return <PadelTournamentWizardClient organizationId={orgId} />;
}
