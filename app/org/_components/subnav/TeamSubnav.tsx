"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function TeamSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "members", label: "Members", href: buildOrgHref(orgId, "/team") },
        { id: "trainers", label: "Trainers", href: buildOrgHref(orgId, "/team/trainers") },
      ]}
    />
  );
}
