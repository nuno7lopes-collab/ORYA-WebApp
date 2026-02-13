"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CrmToolSubnav({
  orgId,
  className,
  campaignsEnabled = false,
}: {
  orgId: number | null;
  className?: string;
  campaignsEnabled?: boolean;
}) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "customers", label: "Customers", href: buildOrgHref(orgId, "/crm/customers") },
        { id: "segments", label: "Segments", href: buildOrgHref(orgId, "/crm/segments") },
        {
          id: "campaigns",
          label: "Campaigns",
          href: buildOrgHref(orgId, "/crm/campaigns"),
          hidden: !campaignsEnabled,
        },
        { id: "journeys", label: "Journeys", href: buildOrgHref(orgId, "/crm/journeys") },
        { id: "reports", label: "Reports", href: buildOrgHref(orgId, "/crm/reports") },
        { id: "loyalty", label: "Loyalty", href: buildOrgHref(orgId, "/crm/loyalty") },
      ]}
    />
  );
}
