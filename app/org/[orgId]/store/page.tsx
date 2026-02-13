import { redirect } from "next/navigation";
import { parseOrganizationId } from "@/lib/organizationIdUtils";
import OrgStoreToolClient from "./OrgStoreToolClient";

export default async function OrgStorePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId: orgIdRaw } = await params;
  const orgId = parseOrganizationId(orgIdRaw);

  if (!orgId) {
    redirect("/org-hub/organizations");
  }

  return <OrgStoreToolClient orgId={orgId} />;
}
