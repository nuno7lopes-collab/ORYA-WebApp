"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function BookingsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "services", label: "Aulas & serviços", href: buildOrgHref(orgId, "/bookings") },
        { id: "operations", label: "Operação diária", href: buildOrgHref(orgId, "/bookings/operations") },
        { id: "customers", label: "Jogadores & alunos", href: buildOrgHref(orgId, "/bookings/customers") },
        { id: "professionals", label: "Treinadores", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "resources", label: "Campos", href: buildOrgHref(orgId, "/bookings/resources") },
        { id: "calendar", label: "Calendário", href: buildOrgHref(orgId, "/calendar") },
        { id: "checkin", label: "Check-in", href: buildOrgHref(orgId, "/check-in") },
      ]}
    />
  );
}
