"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function BookingsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Resumo", href: buildOrgHref(orgId, "/bookings", { bookings: "overview" }) },
        { id: "services", label: "Serviços", href: buildOrgHref(orgId, "/bookings/services") },
        { id: "availability", label: "Disponibilidade", href: buildOrgHref(orgId, "/bookings", { tab: "availability", bookings: "availability" }) },
        { id: "customers", label: "Clientes", href: buildOrgHref(orgId, "/bookings/customers") },
        { id: "professionals", label: "Profissionais", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "resources", label: "Recursos", href: buildOrgHref(orgId, "/bookings/resources") },
        { id: "policies", label: "Políticas", href: buildOrgHref(orgId, "/bookings/policies") },
        { id: "integrations", label: "Integrações", href: buildOrgHref(orgId, "/bookings", { bookings: "integrations" }) },
      ]}
    />
  );
}
