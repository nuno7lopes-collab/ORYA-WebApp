"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FormsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "forms", label: "Formulários", href: buildOrgHref(orgId, "/forms", { section: "forms", view: "ativos" }) },
        { id: "responses", label: "Respostas", href: buildOrgHref(orgId, "/forms", { section: "responses" }) },
        { id: "settings", label: "Definições", href: buildOrgHref(orgId, "/forms", { section: "settings" }) },
      ]}
    />
  );
}
