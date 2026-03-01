"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FormsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveFormsSection = (searchParams: URLSearchParams) => {
    const value = searchParams.get("section") ?? searchParams.get("forms");
    if (!value) return "forms";
    if (value === "responses" || value === "settings") return value;
    return "forms";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "forms",
          label: "Formulários",
          href: buildOrgHref(orgId, "/forms", { section: "forms", view: "ativos" }),
          isActive: ({ searchParams }) => resolveFormsSection(searchParams) === "forms",
        },
        {
          id: "responses",
          label: "Respostas",
          href: buildOrgHref(orgId, "/forms", { section: "responses" }),
          isActive: ({ searchParams }) => resolveFormsSection(searchParams) === "responses",
        },
        {
          id: "settings",
          label: "Definições",
          href: buildOrgHref(orgId, "/forms", { section: "settings" }),
          isActive: ({ searchParams }) => resolveFormsSection(searchParams) === "settings",
        },
      ]}
    />
  );
}
