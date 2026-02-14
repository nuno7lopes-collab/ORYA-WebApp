export const runtime = "nodejs";

import PartnershipWorkspaceClient from "@/app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient";

export default async function OrgPadelPartnershipWorkspacePage({
  params,
}: {
  params: Promise<{ orgId: string; agreementId: string }>;
}) {
  const { orgId, agreementId } = await params;
  const organizationId = Number(orgId);
  const parsedAgreementId = Number(agreementId);

  return (
    <PartnershipWorkspaceClient
      agreementId={Number.isFinite(parsedAgreementId) ? parsedAgreementId : null}
      organizationId={Number.isFinite(organizationId) ? organizationId : null}
    />
  );
}
