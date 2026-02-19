"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PoliciesSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "booking" ||
      view === "crm" ||
      view === "finance" ||
      view === "padel" ||
      view === "terms" ||
      view === "store" ||
      view === "guardrails"
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
          id: "finance",
          label: "Financeiro",
          href: buildOrgHref(orgId, "/policies", { view: "finance" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "finance",
        },
        {
          id: "crm",
          label: "CRM",
          href: buildOrgHref(orgId, "/policies", { view: "crm" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "crm",
        },
        {
          id: "padel",
          label: "Padel",
          href: buildOrgHref(orgId, "/policies", { view: "padel" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "padel",
        },
        {
          id: "terms",
          label: "Termos",
          href: buildOrgHref(orgId, "/policies", { view: "terms" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "terms",
        },
        {
          id: "store",
          label: "Loja",
          href: buildOrgHref(orgId, "/policies", { view: "store" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "store",
        },
        {
          id: "guardrails",
          label: "Limites",
          href: buildOrgHref(orgId, "/policies", { view: "guardrails" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "guardrails",
        },
      ]}
    />
  );
}
