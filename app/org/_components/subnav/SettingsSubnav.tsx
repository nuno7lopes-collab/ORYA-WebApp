"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function SettingsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "general", label: "General", href: buildOrgHref(orgId, "/settings") },
        { id: "verify", label: "Verify", href: buildOrgHref(orgId, "/settings/verify") },
      ]}
    />
  );
}
