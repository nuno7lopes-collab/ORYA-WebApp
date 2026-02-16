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
        { id: "availability", label: "Disponibilidade", href: buildOrgHref(orgId, "/bookings/availability") },
        { id: "customers", label: "Clientes", href: buildOrgHref(orgId, "/bookings/customers") },
        { id: "professionals", label: "Profissionais", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "resources", label: "Recursos", href: buildOrgHref(orgId, "/bookings/resources") },
        { id: "policies", label: "Políticas", href: buildOrgHref(orgId, "/policies", { view: "booking" }) },
        { id: "prices", label: "Preços", href: buildOrgHref(orgId, "/bookings/prices") },
        { id: "integrations", label: "Integrações", href: buildOrgHref(orgId, "/bookings/integrations") },
      ]}
    />
  );
}
