"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CalendarSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "week", label: "Semana", href: buildOrgHref(orgId, "/calendar", { view: "week" }) },
        { id: "day", label: "Dia", href: buildOrgHref(orgId, "/calendar", { view: "day" }) },
        { id: "month", label: "Mês", href: buildOrgHref(orgId, "/calendar", { view: "month" }) },
        { id: "availability", label: "Disponibilidade", href: buildOrgHref(orgId, "/calendar/availability") },
        { id: "conflicts", label: "Conflitos", href: buildOrgHref(orgId, "/calendar/conflicts") },
      ]}
    />
  );
}
