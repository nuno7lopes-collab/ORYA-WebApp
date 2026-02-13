import { notFound } from "next/navigation";
import PadelTournamentWizardClient from "@/app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient";

export default async function OrgPadelTournamentCreatePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const parsedOrgId = Number(orgId);
  if (!Number.isFinite(parsedOrgId) || parsedOrgId <= 0) {
    notFound();
  }
  return <PadelTournamentWizardClient organizationId={parsedOrgId} />;
}
