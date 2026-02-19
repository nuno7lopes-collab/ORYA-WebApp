export const runtime = "nodejs";

import { redirect } from "next/navigation";

export default async function OrgPadelPartnershipsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/padel/clubs?tab=manage&section=padel-club&padel=partnerships`);
}
