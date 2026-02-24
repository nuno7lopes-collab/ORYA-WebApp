import OrgCheckInOperationsClient from "../OrgCheckInOperationsClient";
import { redirect } from "next/navigation";
import { buildOrgHubHref } from "@/lib/organizationIdUtils";

export default async function OrgCheckInSessionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = await params;
  const orgId = Number(resolved.orgId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    redirect(buildOrgHubHref("/organizations"));
  }
  return <OrgCheckInOperationsClient orgId={orgId} mode="sessions" />;
}
