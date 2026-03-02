"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function AcademySubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "services", label: "Aulas & serviços", href: buildOrgHref(orgId, "/bookings") },
        { id: "classes", label: "Aulas", href: buildOrgHref(orgId, "/bookings/classes") },
        { id: "professionals", label: "Treinadores", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "customers", label: "Jogadores & alunos", href: buildOrgHref(orgId, "/bookings/customers") },
      ]}
    />
  );
}
