"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function AnalyticsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "conversion" ||
      view === "cohorts" ||
      view === "buyers" ||
      view === "time-series" ||
      view === "dimensions" ||
      view === "telemetry"
    ) {
      return view;
    }
    return "overview";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "overview",
          label: "Resumo",
          href: buildOrgHref(orgId, "/analytics", { view: "overview" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "overview",
        },
        {
          id: "conversion",
          label: "Conversão",
          href: buildOrgHref(orgId, "/analytics", { view: "conversion" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "conversion",
        },
        {
          id: "cohorts",
          label: "Coortes",
          href: buildOrgHref(orgId, "/analytics", { view: "cohorts" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "cohorts",
        },
        {
          id: "buyers",
          label: "Compradores",
          href: buildOrgHref(orgId, "/analytics", { view: "buyers" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "buyers",
        },
        {
          id: "time-series",
          label: "Séries",
          href: buildOrgHref(orgId, "/analytics", { view: "time-series" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "time-series",
        },
        {
          id: "dimensions",
          label: "Dimensões",
          href: buildOrgHref(orgId, "/analytics", { view: "dimensions" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "dimensions",
        },
        {
          id: "telemetry",
          label: "Telemetria",
          href: buildOrgHref(orgId, "/analytics", { view: "telemetry" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "telemetry",
        },
      ]}
    />
  );
}
