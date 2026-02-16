"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CalendarSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "week", label: "Semana", href: buildOrgHref(orgId, "/calendar") },
        { id: "day", label: "Dia", href: buildOrgHref(orgId, "/calendar/day") },
      ]}
    />
  );
}
