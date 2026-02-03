import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref, resolveOrganizationIdFromSearchParams } from "@/lib/organizationId";
import PadelTournamentWizardClient from "./PadelTournamentWizardClient";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function PadelTournamentWizard({ searchParams }: Props) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const orgId = resolveOrganizationIdFromSearchParams(resolvedSearchParams);
  if (!orgId) {
    const target = await appendOrganizationIdToRedirectHref("/organizacao/padel/torneios/novo", resolvedSearchParams);
    redirect(target);
  }
  return <PadelTournamentWizardClient organizationId={orgId} />;
}
