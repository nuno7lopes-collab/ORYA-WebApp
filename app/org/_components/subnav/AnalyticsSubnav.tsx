"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function AnalyticsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Resumo", href: buildOrgHref(orgId, "/analytics", { tab: "overview", analytics: "overview" }) },
        { id: "occupancy", label: "Ocupação", href: buildOrgHref(orgId, "/analytics", { tab: "overview", analytics: "occupancy" }) },
        { id: "conversion", label: "Conversão", href: buildOrgHref(orgId, "/analytics", { tab: "vendas", analytics: "conversion" }) },
        { id: "no-show", label: "Faltas", href: buildOrgHref(orgId, "/analytics", { tab: "ops", analytics: "no-show" }) },
        { id: "cohorts", label: "Coortes", href: buildOrgHref(orgId, "/analytics", { tab: "overview", analytics: "cohorts" }) },
      ]}
    />
  );
}
