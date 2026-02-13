"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function AnalyticsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Overview", href: buildOrgHref(orgId, "/analytics") },
        { id: "occupancy", label: "Occupancy", href: buildOrgHref(orgId, "/analytics/occupancy") },
        { id: "conversion", label: "Conversion", href: buildOrgHref(orgId, "/analytics/conversion") },
        { id: "no-show", label: "No-show", href: buildOrgHref(orgId, "/analytics/no-show") },
        { id: "cohorts", label: "Cohorts", href: buildOrgHref(orgId, "/analytics/cohorts") },
      ]}
    />
  );
}
