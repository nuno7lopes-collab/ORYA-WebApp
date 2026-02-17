"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function ChatSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "inbox", label: "Caixa de entrada", href: buildOrgHref(orgId, "/chat") },
      ]}
    />
  );
}
