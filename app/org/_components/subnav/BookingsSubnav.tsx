"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function BookingsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "services", label: "Serviços", href: buildOrgHref(orgId, "/bookings") },
        { id: "operations", label: "Operações", href: buildOrgHref(orgId, "/bookings/operations") },
        { id: "customers", label: "Clientes", href: buildOrgHref(orgId, "/bookings/customers") },
        { id: "professionals", label: "Profissionais", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "resources", label: "Recursos", href: buildOrgHref(orgId, "/bookings/resources") },
      ]}
    />
  );
}
