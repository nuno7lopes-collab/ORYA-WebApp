"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CheckInSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "scanner", label: "Scanner", href: buildOrgHref(orgId, "/check-in/scanner") },
        { id: "list", label: "List", href: buildOrgHref(orgId, "/check-in/list") },
        { id: "sessions", label: "Sessions", href: buildOrgHref(orgId, "/check-in/sessions") },
        { id: "logs", label: "Logs", href: buildOrgHref(orgId, "/check-in/logs") },
        { id: "devices", label: "Devices", href: buildOrgHref(orgId, "/check-in/devices") },
      ]}
    />
  );
}
