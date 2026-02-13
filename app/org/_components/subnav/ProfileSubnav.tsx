"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function ProfileSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "profile", label: "Profile", href: buildOrgHref(orgId, "/profile") },
        { id: "followers", label: "Followers", href: buildOrgHref(orgId, "/profile/followers") },
        { id: "requests", label: "Requests", href: buildOrgHref(orgId, "/profile/requests") },
      ]}
    />
  );
}
