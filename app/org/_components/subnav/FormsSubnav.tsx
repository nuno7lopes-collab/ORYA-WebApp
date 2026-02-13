"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FormsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "forms", label: "Forms", href: buildOrgHref(orgId, "/forms") },
        { id: "responses", label: "Responses", href: buildOrgHref(orgId, "/forms/responses") },
        { id: "settings", label: "Settings", href: buildOrgHref(orgId, "/forms/settings") },
      ]}
    />
  );
}
