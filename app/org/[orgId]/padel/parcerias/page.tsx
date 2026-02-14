export const runtime = "nodejs";

import PartnershipsPageClient from "@/app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient";

export default async function OrgPadelPartnershipsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const organizationId = Number(orgId);
  return <PartnershipsPageClient organizationId={Number.isFinite(organizationId) ? organizationId : null} />;
}
