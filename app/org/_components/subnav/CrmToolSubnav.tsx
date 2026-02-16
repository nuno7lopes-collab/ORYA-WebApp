"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CrmToolSubnav({
  orgId,
  className,
}: {
  orgId: number | null;
  className?: string;
}) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "customers", label: "Clientes", href: buildOrgHref(orgId, "/crm/customers") },
        { id: "segments", label: "Segmentos", href: buildOrgHref(orgId, "/crm/segments") },
        {
          id: "campaigns",
          label: "Campanhas",
          href: buildOrgHref(orgId, "/crm/campaigns"),
        },
        { id: "journeys", label: "Jornadas", href: buildOrgHref(orgId, "/crm/journeys") },
        { id: "reports", label: "Relatórios", href: buildOrgHref(orgId, "/crm/reports") },
        { id: "loyalty", label: "Fidelização", href: buildOrgHref(orgId, "/crm/loyalty") },
      ]}
    />
  );
}
