"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CalendarSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;
  const basePath = buildOrgHref(orgId, "/calendar");

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "agenda",
          label: "Agenda",
          href: buildOrgHref(orgId, "/calendar", { view: "week" }),
          isActive: ({ normalizedPathname, searchParams }) => {
            if (!normalizedPathname) return false;
            if (normalizedPathname !== basePath && normalizedPathname !== `${basePath}/day`) return false;
            if (normalizedPathname === `${basePath}/day`) return true;
            const view = searchParams.get("view");
            return view === null || view === "day" || view === "week" || view === "month";
          },
        },
        { id: "availability", label: "Disponibilidade", href: buildOrgHref(orgId, "/calendar/availability") },
        { id: "conflicts", label: "Conflitos", href: buildOrgHref(orgId, "/calendar/conflicts") },
      ]}
    />
  );
}
