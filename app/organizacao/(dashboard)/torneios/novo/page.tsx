import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref, resolveOrganizationIdFromSearchParams } from "@/lib/organizationId";
import PadelTournamentWizardClient from "@/app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OrganizationTorneiosNovoPage({ searchParams }: Props) {
  const orgId = resolveOrganizationIdFromSearchParams(searchParams);
  if (!orgId) {
    const target = await appendOrganizationIdToRedirectHref("/organizacao/torneios/novo", searchParams);
    redirect(target);
  }
  return <PadelTournamentWizardClient organizationId={orgId} />;
}
