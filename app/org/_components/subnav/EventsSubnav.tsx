"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function EventsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "list", label: "Lista", href: buildOrgHref(orgId, "/events") },
        { id: "new", label: "Novo", href: buildOrgHref(orgId, "/events/new") },
      ]}
    />
  );
}
