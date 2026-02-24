import type { ReactNode } from "react";
import OrganizationAuthLayout from "@/app/org/_internal/core/layout";
import OrganizationDashboardLayout from "@/app/org/_internal/core/(dashboard)/layout";
import { parseOrganizationId } from "@/lib/organizationIdUtils";

type OrgScopedLayoutParams = Promise<{ orgId: string }> | { orgId: string };

export default async function OrgScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: OrgScopedLayoutParams;
}) {
  const resolvedParams = await Promise.resolve(params);
  const requestedOrgId = parseOrganizationId(resolvedParams.orgId);

  return (
    <OrganizationAuthLayout>
      <OrganizationDashboardLayout requestedOrgId={requestedOrgId}>
        {children}
      </OrganizationDashboardLayout>
    </OrganizationAuthLayout>
  );
}
