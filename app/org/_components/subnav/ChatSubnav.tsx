"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function ChatSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "inbox", label: "Inbox", href: buildOrgHref(orgId, "/chat") },
        { id: "preview", label: "Preview", href: buildOrgHref(orgId, "/chat/preview") },
      ]}
    />
  );
}
