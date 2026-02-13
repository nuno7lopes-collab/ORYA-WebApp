import OrgProfileFollowersClient from "../OrgProfileFollowersClient";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = await params;
  const orgId = Number(resolved.orgId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    return null;
  }
  return <OrgProfileFollowersClient orgId={orgId} />;
}
