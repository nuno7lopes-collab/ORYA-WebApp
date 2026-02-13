import OrgCheckInOperationsClient from "../OrgCheckInOperationsClient";

export default async function OrgCheckInSessionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = await params;
  const orgId = Number(resolved.orgId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    return null;
  }
  return <OrgCheckInOperationsClient orgId={orgId} mode="sessions" />;
}
