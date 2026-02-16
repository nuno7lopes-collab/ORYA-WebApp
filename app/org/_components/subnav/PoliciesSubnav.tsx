"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PoliciesSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (view === "overview" || view === "booking" || view === "terms" || view === "guardrails") {
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
          href: buildOrgHref(orgId, "/policies", { view: "overview" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "overview",
        },
        {
          id: "booking",
          label: "Reservas",
          href: buildOrgHref(orgId, "/policies", { view: "booking" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "booking",
        },
        {
          id: "terms",
          label: "Termos",
          href: buildOrgHref(orgId, "/policies", { view: "terms" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "terms",
        },
        {
          id: "guardrails",
          label: "Guardrails",
          href: buildOrgHref(orgId, "/policies", { view: "guardrails" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "guardrails",
        },
      ]}
    />
  );
}
