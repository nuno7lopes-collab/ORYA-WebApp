import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref, resolveOrganizationIdFromSearchParams } from "@/lib/organizationId";
import PadelTournamentWizardClient from "./PadelTournamentWizardClient";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function PadelTournamentWizard({ searchParams }: Props) {
  const orgId = resolveOrganizationIdFromSearchParams(searchParams);
  if (!orgId) {
    const target = await appendOrganizationIdToRedirectHref("/organizacao/padel/torneios/novo", searchParams);
    redirect(target);
  }
  return <PadelTournamentWizardClient organizationId={orgId} />;
}
